import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { executeCommand } from "@/lib/game/engine";
import { getGameStore } from "@/lib/game/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const commandRequestSchema = z.object({
  command: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const parsed = commandRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a command between 1 and 500 characters." },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const existingGuestId = cookieStore.get("nextmud_guest")?.value;
    const characterId = existingGuestId ?? randomUUID();
    const store = getGameStore();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const character = await store.getOrCreate(characterId);
      const result = executeCommand(character.state, parsed.data.command);
      const committed = await store.commit(
        characterId,
        character.version,
        result.state,
      );

      if (committed) {
        const response = NextResponse.json({
          messages: result.messages,
          character: {
            health: result.state.health,
            maxHealth: result.state.maxHealth,
            experience: result.state.experience,
            level: result.state.level,
          },
        });

        if (!existingGuestId) {
          response.cookies.set("nextmud_guest", characterId, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
          });
        }

        return response;
      }
    }

    return NextResponse.json(
      { error: "The world shifted beneath you. Please try that command again." },
      { status: 409 },
    );
  } catch (error) {
    console.error("Command execution failed", error);
    return NextResponse.json(
      { error: "The realm is temporarily unavailable." },
      { status: 500 },
    );
  }
}
