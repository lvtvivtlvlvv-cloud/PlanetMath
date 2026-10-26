import crypto from "crypto";
import { NextResponse } from "next/server";
import { cleanupExpiredFiles } from "@/lib/cleanup-files";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;

  // Без настроенного секрета endpoint закрыт: иначе чистку может дёргать кто угодно.
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET не настроен" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await cleanupExpiredFiles();
  return NextResponse.json(result);
}
