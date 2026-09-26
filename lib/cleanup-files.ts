import fs from "fs/promises";
import path from "path";
import { db } from "./db";

export async function cleanupExpiredFiles(): Promise<{ deletedCount: number; errors: string[] }> {
  const now = new Date();
  const errors: string[] = [];

  const expiredRecords = await db.attachment.findMany({
    where: { expiresAt: { lte: now } },
  });

  if (expiredRecords.length === 0) {
    return { deletedCount: 0, errors: [] };
  }

  const publicDir = path.join(process.cwd(), "public");

  for (const item of expiredRecords) {
    try {
      const sanitizedUrl = item.fileUrl.replace(/^\/+/, "");
      const absolutePath = path.join(publicDir, sanitizedUrl);
      await fs.unlink(absolutePath).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== "ENOENT") throw err;
      });
    } catch (e: unknown) {
      errors.push(`FS error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const deleteResult = await db.attachment.deleteMany({
    where: { id: { in: expiredRecords.map((r) => r.id) } },
  });

  return { deletedCount: deleteResult.count, errors };
}