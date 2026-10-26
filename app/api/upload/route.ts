import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getSessionUser } from "@/lib/session";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  inspectUpload,
  UPLOADS_DIR,
} from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Загружать файлы могут только авторизованные пользователи.
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const formData = await req.formData();
    const rawFiles = formData.getAll("files");
    const files = rawFiles.filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "Файлы не переданы" }, { status: 400 });
    }

    if (files.length > MAX_UPLOAD_FILES) {
      return NextResponse.json(
        { error: `За один раз можно загрузить не более ${MAX_UPLOAD_FILES} файлов` },
        { status: 400 }
      );
    }

    const uploaded: Array<{
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize: number;
      expiresAt: string;
    }> = [];

    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: `Файл «${file.name}» больше 15 МБ` }, { status: 413 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length === 0) {
        return NextResponse.json({ error: `Файл «${file.name}» пустой` }, { status: 400 });
      }

      // Проверяем MIME + реальное содержимое (магические байты).
      const { ext } = inspectUpload(file, buffer);

      await fs.mkdir(UPLOADS_DIR, { recursive: true });

      // Имя генерируем сами: оригинальное имя может содержать html/svg-разметку.
      const safeName = `${crypto.randomUUID()}${ext}`;
      const filePath = path.join(UPLOADS_DIR, safeName);
      await fs.writeFile(filePath, buffer, { flag: "wx" });

      uploaded.push({
        fileName: file.name.slice(0, 200),
        fileUrl: `/uploads/${safeName}`,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return NextResponse.json({ files: uploaded });
  } catch (error: any) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error && /файл|тип|содержимое|размер/i.test(error.message)
        ? error.message
        : "Не удалось загрузить файл";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
