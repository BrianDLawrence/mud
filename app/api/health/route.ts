import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    persistence: process.env.MONGODB_URI ? "mongodb" : "memory-development-only",
  });
}
