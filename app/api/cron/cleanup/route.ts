import { NextResponse } from "next/server";
import { cleanupExpiredFiles } from "@/lib/cleanup-files";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await cleanupExpiredFiles();
  return NextResponse.json(result);
}