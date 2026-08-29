import { NextResponse } from "next/server";
import {
  characterNameSchema,
  normalizeCharacterName,
} from "@/lib/game/character-name";
import { getPlayerCharacter } from "@/lib/game/player-character";
import { getGameStore } from "@/lib/game/store";
import type { CharacterProfile, StoredCharacter } from "@/lib/game/types";
import { getAuthenticatedPlayer } from "@/lib/player-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toProfile(id: string, character: StoredCharacter): CharacterProfile {
  return {
    id,
    name: character.name,
    summary: {
      health: character.state.health,
      maxHealth: character.state.maxHealth,
      experience: character.state.experience,
      level: character.state.level,
    },
  };
}

export async function GET(request: Request) {
  const player = await getAuthenticatedPlayer(request);
  if (!player) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const ownedCharacter = await getPlayerCharacter(getGameStore(), player);
  if (!ownedCharacter) {
    return NextResponse.json({ character: null });
  }

  return NextResponse.json({
    character: toProfile(ownedCharacter.id, ownedCharacter.character),
  });
}

export async function POST(request: Request) {
  const player = await getAuthenticatedPlayer(request);
  if (!player) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const parsedName = characterNameSchema.safeParse(body?.name);
  if (!parsedName.success) {
    return NextResponse.json(
      { error: parsedName.error.issues[0]?.message || "Invalid character name." },
      { status: 400 },
    );
  }

  const store = getGameStore();
  const existing = await getPlayerCharacter(store, player);
  if (existing) {
    return NextResponse.json(
      { character: toProfile(existing.id, existing.character) },
      { status: 409 },
    );
  }

  const result = await store.create(
    player.id,
    parsedName.data,
    normalizeCharacterName(parsedName.data),
  );

  if (!result.created) {
    return NextResponse.json(
      {
        error:
          result.reason === "name_taken"
            ? "That character name has already been claimed."
            : "This account already has a character.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { character: toProfile(player.id, result.character) },
    { status: 201 },
  );
}
