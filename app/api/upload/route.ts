import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Файлы не переданы" }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const savedFiles = [];
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const filePath = path.join(uploadsDir, safeName);
      await fs.writeFile(filePath, buffer);

      savedFiles.push({
        fileName: file.name,
        fileUrl: `/uploads/${safeName}`,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        expiresAt,
      });
    }

    return NextResponse.json({ files: savedFiles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Ошибка загрузки" }, { status: 500 });
  }
}