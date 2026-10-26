import fs from "fs/promises";
import { db } from "./db";
import { resolveUploadPath } from "./uploads";

export async function cleanupExpiredFiles(): Promise<{ deletedCount: number; errors: string[] }> {
  const now = new Date();
  const errors: string[] = [];

  const expiredRecords = await db.attachment.findMany({
    where: { expiresAt: { lte: now } },
  });

  if (expiredRecords.length === 0) {
    return { deletedCount: 0, errors: [] };
  }

  for (const item of expiredRecords) {
    // Ссылка из БД может быть подделана (исторические записи) — на диск попадаем
    // только если путь действительно внутри public/uploads.
    const absolutePath = resolveUploadPath(item.fileUrl);

    if (!absolutePath) {
      errors.push(`Небезопасный путь вложения пропущен: ${String(item.fileUrl).slice(0, 80)}`);
      continue;
    }

    try {
      await fs.unlink(absolutePath).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== "ENOENT") throw err;
      });
    } catch (e: unknown) {
      errors.push(`FS error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Записи удаляем в любом случае: файла уже нет либо путь был невалиден.
  const deleteResult = await db.attachment.deleteMany({
    where: { id: { in: expiredRecords.map((r) => r.id) } },
  });

  return { deletedCount: deleteResult.count, errors };
}
