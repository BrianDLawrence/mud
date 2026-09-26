import { NextResponse } from "next/server";
import { advanceCombat } from "@/lib/game/engine";
import { publishDeath, settleCharacter } from "@/lib/game/character-service";
import { getRoomStore } from "@/lib/game/room-store";
import { getPlayerCharacter } from "@/lib/game/player-character";
import { getGameStore } from "@/lib/game/store";
import { characterSummary } from "@/lib/game/summary";
import { getAuthenticatedPlayer } from "@/lib/player-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const player = await getAuthenticatedPlayer(request);
    if (!player) {
      return NextResponse.json(
        { error: "You must sign in before entering combat." },
        { status: 401 },
      );
    }

    const store = getGameStore();
    const roomStore = getRoomStore();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ownedCharacter = await getPlayerCharacter(store, player);
      if (!ownedCharacter) {
        return NextResponse.json(
          { error: "Create a character before entering combat." },
          { status: 404 },
        );
      }

      const settled = await settleCharacter(store, roomStore, ownedCharacter.id);
      if (!settled) continue;
      const current = settled.character;

      if (!current.state.combat) {
        return NextResponse.json({
          messages: [],
          character: characterSummary(current.state),
        });
      }

      const result = advanceCombat(current.state);
      const changed =
        result.messages.length > 0 ||
        Boolean(current.state.combat) !==
          Boolean(result.state.combat);
      if (!changed) {
        return NextResponse.json({
          messages: [],
          character: characterSummary(result.state),
        });
      }

      const committed = await store.commit(
        ownedCharacter.id,
        current.version,
        result.state,
      );
      if (committed) {
        if (result.state.deathDrop?.id !== current.state.deathDrop?.id) {
          await publishDeath(store, roomStore, ownedCharacter.id, { ...current, state: result.state });
        }
        return NextResponse.json({
          messages: result.messages,
          character: characterSummary(result.state),
        });
      }
    }

    return NextResponse.json(
      { error: "The fight shifted unexpectedly. It will resume in a moment." },
      { status: 409 },
    );
  } catch (error) {
    console.error("Combat advancement failed", error);
    return NextResponse.json(
      { error: "Combat is temporarily unavailable." },
      { status: 500 },
    );
  }
}
