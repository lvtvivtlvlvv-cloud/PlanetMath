import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const hostDate = new Date();
  return NextResponse.json({
    serverTime: hostDate.toISOString(),
    timestamp: hostDate.getTime(),
    timezoneOffset: hostDate.getTimezoneOffset(),
  });
}