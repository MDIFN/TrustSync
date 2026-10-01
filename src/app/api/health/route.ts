import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "trustsync",
    timestamp: new Date().toISOString(),
  });
}
