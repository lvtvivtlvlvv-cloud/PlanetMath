import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parsePdfBuffer } from "@/lib/ege-parser";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 40 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Разрешены только файлы формата PDF" }, { status: 400 });
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF больше 40 МБ" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 5 || buffer.toString("ascii", 0, 4) !== "%PDF") {
      return NextResponse.json({ error: "Файл не похож на PDF" }, { status: 400 });
    }

    const { tasks, numpages, sampleSummary } = await parsePdfBuffer(buffer, {
      source: `UPLOAD_${file.name.substring(0, 30)}`,
    });

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: "В данном PDF-файле не удалось распознать текстовые формулировки заданий." },
        { status: 422 }
      );
    }

    let added = 0;
    let updated = 0;

    // Дедупликация и запись в одной транзакции: при ошибке банк не остаётся
    // наполовину обновлённым.
    await db.$transaction(async (tx) => {
      for (const item of tasks) {
        const existing = await tx.egeTask.findFirst({
          where: { taskNumber: item.taskNumber, title: item.title },
        });

        if (existing) {
          await tx.egeTask.update({
            where: { id: existing.id },
            data: {
              content: item.content,
              topic: item.topic,
              answer: item.answer || existing.answer,
              solution: item.solution || existing.solution,
              difficulty: item.difficulty,
            },
          });
          updated++;
        } else {
          await tx.egeTask.create({
            data: {
              taskNumber: item.taskNumber,
              topic: item.topic,
              title: item.title,
              content: item.content,
              answer: item.answer,
              solution: item.solution,
              difficulty: item.difficulty,
              source: item.source,
            },
          });
          added++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      pages: numpages,
      totalExtracted: tasks.length,
      added,
      updated,
      summary: sampleSummary,
    });
  } catch (err: any) {
    console.error("PDF import error:", err);
    return NextResponse.json({ error: "Не удалось обработать PDF" }, { status: 500 });
  }
}
