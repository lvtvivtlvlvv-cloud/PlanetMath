import path from "path";

/**
 * Работа с вложениями.
 *
 * Главное правило: URL файла, пришедший от клиента, — это НЕ путь на диске.
 * Принимаем только `/uploads/<безопасное имя>`, а на диск попадаем через
 * basename + проверку префикса (защита от `../`).
 */

export const UPLOADS_URL_PREFIX = "/uploads/";
export const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const SAFE_UPLOAD_URL_RE = /^\/uploads\/[A-Za-z0-9._-]{1,160}$/;

export function isSafeUploadUrl(url: unknown): url is string {
  return typeof url === "string" && SAFE_UPLOAD_URL_RE.test(url) && !url.includes("..");
}

/** Абсолютный путь к файлу в uploads или null, если URL небезопасен. */
export function resolveUploadPath(fileUrl: unknown): string | null {
  if (!isSafeUploadUrl(fileUrl)) return null;

  const root = path.resolve(UPLOADS_DIR);
  const absolute = path.resolve(root, path.basename(fileUrl));

  if (absolute !== root && !absolute.startsWith(root + path.sep)) return null;
  return absolute;
}

export interface IncomingAttachment {
  fileName?: unknown;
  fileUrl?: unknown;
  fileType?: unknown;
  fileSize?: unknown;
  expiresAt?: unknown;
}

export interface NormalizedAttachment {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  expiresAt: Date;
}

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Приводит вложения из тела запроса к безопасному виду.
 * Бросает исключение, если URL не похож на наш upload.
 */
export function normalizeAttachments(input: unknown): NormalizedAttachment[] {
  if (!Array.isArray(input) || input.length === 0) return [];
  if (input.length > 10) throw new Error("Слишком много вложений");

  return input.map((raw) => {
    const item = (raw ?? {}) as IncomingAttachment;

    if (!isSafeUploadUrl(item.fileUrl)) {
      throw new Error("Недопустимая ссылка на вложение");
    }

    const fileName =
      typeof item.fileName === "string" && item.fileName.trim()
        ? item.fileName.trim().slice(0, 200)
        : "Файл";

    const fileType =
      typeof item.fileType === "string" && item.fileType.trim()
        ? item.fileType.trim().slice(0, 100)
        : "application/octet-stream";

    const fileSize =
      typeof item.fileSize === "number" && Number.isFinite(item.fileSize) && item.fileSize >= 0
        ? Math.min(Math.round(item.fileSize), 2_000_000_000)
        : 0;

    let expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
    if (typeof item.expiresAt === "string" || item.expiresAt instanceof Date) {
      const parsed = new Date(item.expiresAt);
      if (!Number.isNaN(parsed.getTime())) expiresAt = parsed;
    }

    return { fileName, fileUrl: item.fileUrl, fileType, fileSize, expiresAt };
  });
}

const ALLOWED_TYPES: Record<string, { ext: string; magic: (buf: Buffer) => boolean }> = {
  "image/jpeg": {
    ext: ".jpg",
    magic: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  "image/png": {
    ext: ".png",
    magic: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/webp": {
    ext: ".webp",
    magic: (b) =>
      b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  },
  "image/gif": {
    ext: ".gif",
    magic: (b) => b.length > 6 && (b.toString("ascii", 0, 6) === "GIF87a" || b.toString("ascii", 0, 6) === "GIF89a"),
  },
  "application/pdf": {
    ext: ".pdf",
    magic: (b) => b.length > 4 && b.toString("ascii", 0, 4) === "%PDF",
  },
};

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 6;

/** Проверяет MIME и реальное содержимое (магические байты). */
export function inspectUpload(file: File, buffer: Buffer): { ext: string } {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Файл больше 15 МБ");
  }

  const type = (file.type || "").toLowerCase();
  const rule = ALLOWED_TYPES[type];

  if (!rule) {
    throw new Error("Недопустимый тип файла. Разрешены JPG, PNG, WEBP, GIF и PDF.");
  }

  if (!rule.magic(buffer)) {
    throw new Error("Содержимое файла не соответствует его типу");
  }

  return { ext: rule.ext };
}
