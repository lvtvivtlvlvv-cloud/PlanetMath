import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface ResolvedRange {
  start: number;
  end: number;
}

/**
 * Разбор заголовка Range по RFC 7233.
 * Поддерживает `bytes=0-100`, `bytes=100-` и суффиксный `bytes=-500`.
 */
function parseRange(header: string, fileSize: number): ResolvedRange | "invalid" | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;

  if (!rawStart && !rawEnd) return "invalid";

  // Суффиксный диапазон: последние N байт.
  if (!rawStart && rawEnd) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "invalid";
    const start = Math.max(0, fileSize - suffixLength);
    return { start, end: fileSize - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : fileSize - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
  if (start < 0 || end < start || start >= fileSize) return "invalid";

  return { start, end: Math.min(end, fileSize - 1) };
}

function nodeStreamToWeb(
  fileStream: fs.ReadStream
): { stream: ReadableStream<Uint8Array>; cancel: () => void } {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      fileStream.on("data", (chunk: string | Buffer) =>
        controller.enqueue(typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk))
      );
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      fileStream.destroy();
    },
  });

  return { stream, cancel: () => fileStream.destroy() };
}

export async function GET(req: NextRequest) {
  try {
    const candidatePaths = [
      path.join(process.cwd(), "public", "ege-bank.pdf"),
      path.join(process.cwd(), "Открытый банк задач ФИПИ. ЕГЭ по профильной математике.pdf"),
      path.join(process.cwd(), "tasks.pdf"),
    ];

    let filePath: string | null = null;
    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        filePath = candidate;
        break;
      }
    }

    if (!filePath) {
      return new NextResponse("PDF-файл банка задач не найден", { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      const parsed = parseRange(rangeHeader, fileSize);

      if (parsed === "invalid") {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      if (parsed) {
        const { start, end } = parsed;
        const fileStream = fs.createReadStream(filePath, { start, end });
        const { stream } = nodeStreamToWeb(fileStream);

        return new NextResponse(stream, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(end - start + 1),
            "Content-Type": "application/pdf",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
      // Неизвестный формат Range — отдаём файл целиком, как разрешает RFC.
    }

    const fileStream = fs.createReadStream(filePath);
    const { stream } = nodeStreamToWeb(fileStream);

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": "application/pdf",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error serving EGE PDF:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
