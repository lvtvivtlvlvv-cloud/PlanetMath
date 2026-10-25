import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parsePdfBuffer } from "@/lib/ege-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Разрешены только файлы формата PDF" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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

    for (const item of tasks) {
      const existing = await db.egeTask.findFirst({
        where: {
          taskNumber: item.taskNumber,
          title: item.title,
        },
      });

      if (existing) {
        await db.egeTask.update({
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
        await db.egeTask.create({
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
    return NextResponse.json({ error: err.message || "Ошибка при обработке PDF" }, { status: 500 });
  }
}
