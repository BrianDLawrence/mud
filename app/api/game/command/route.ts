import { NextResponse } from "next/server";
import { z } from "zod";
import { executeCommand } from "@/lib/game/engine";
import { getPlayerCharacter } from "@/lib/game/player-character";
import { getGameStore } from "@/lib/game/store";
import { getAuthenticatedPlayer } from "@/lib/player-identity";

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

    const player = await getAuthenticatedPlayer(request);
    if (!player) {
      return NextResponse.json(
        { error: "You must sign in before entering the realm." },
        { status: 401 },
      );
    }

    const store = getGameStore();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ownedCharacter = await getPlayerCharacter(store, player);
      if (!ownedCharacter) {
        return NextResponse.json(
          { error: "Create a character before entering the realm." },
          { status: 404 },
        );
      }
      const result = executeCommand(
        ownedCharacter.character.state,
        parsed.data.command,
      );
      const committed = await store.commit(
        ownedCharacter.id,
        ownedCharacter.character.version,
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
