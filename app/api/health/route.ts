import { NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    persistence: process.env.MONGODB_URI ? "mongodb" : "memory-development-only",
    authentication: isAuthConfigured() ? "configured" : "incomplete",
    discordActivity:
      process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID && isAuthConfigured()
        ? "configured"
        : "incomplete",
  });
}
