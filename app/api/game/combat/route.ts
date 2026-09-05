import { NextResponse } from "next/server";
import { advanceCombat } from "@/lib/game/engine";
import { getPlayerCharacter } from "@/lib/game/player-character";
import { getGameStore } from "@/lib/game/store";
import type { CharacterState } from "@/lib/game/types";
import { getAuthenticatedPlayer } from "@/lib/player-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function characterSummary(state: CharacterState) {
  return {
    discipline: state.discipline,
    health: state.health,
    maxHealth: state.maxHealth,
    mana: state.mana,
    maxMana: state.maxMana,
    experience: state.experience,
    level: state.level,
    inCombat: Boolean(state.combat),
    attacking: state.combat?.playerAttacking ?? false,
  };
}

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
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ownedCharacter = await getPlayerCharacter(store, player);
      if (!ownedCharacter) {
        return NextResponse.json(
          { error: "Create a character before entering combat." },
          { status: 404 },
        );
      }

      if (!ownedCharacter.character.state.combat) {
        return NextResponse.json({
          messages: [],
          character: characterSummary(ownedCharacter.character.state),
        });
      }

      const result = advanceCombat(ownedCharacter.character.state);
      const changed =
        result.messages.length > 0 ||
        Boolean(ownedCharacter.character.state.combat) !==
          Boolean(result.state.combat);
      if (!changed) {
        return NextResponse.json({
          messages: [],
          character: characterSummary(result.state),
        });
      }

      const committed = await store.commit(
        ownedCharacter.id,
        ownedCharacter.character.version,
        result.state,
      );
      if (committed) {
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
