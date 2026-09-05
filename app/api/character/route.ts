import { NextResponse } from "next/server";
import { z } from "zod";
import {
  characterNameSchema,
  normalizeCharacterName,
} from "@/lib/game/character-name";
import { getPlayerCharacter } from "@/lib/game/player-character";
import {
  chooseDiscipline,
  CURRENT_DISCIPLINE_REVISION,
} from "@/lib/game/disciplines";
import { getGameStore } from "@/lib/game/store";
import {
  disciplineIds,
  type CharacterProfile,
  type StoredCharacter,
} from "@/lib/game/types";
import { getAuthenticatedPlayer } from "@/lib/player-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const disciplineRequestSchema = z.object({
  discipline: z.enum(disciplineIds),
});

function toProfile(id: string, character: StoredCharacter): CharacterProfile {
  return {
    id,
    name: character.name,
    discipline: character.state.discipline,
    disciplineSelectionRequired:
      !character.state.discipline ||
      character.state.disciplineRevision < CURRENT_DISCIPLINE_REVISION,
    summary: {
      discipline: character.state.discipline,
      health: character.state.health,
      maxHealth: character.state.maxHealth,
      mana: character.state.mana,
      maxMana: character.state.maxMana,
      experience: character.state.experience,
      level: character.state.level,
      inCombat: Boolean(character.state.combat),
      attacking: character.state.combat?.playerAttacking ?? false,
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

export async function PATCH(request: Request) {
  const player = await getAuthenticatedPlayer(request);
  if (!player) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const parsed = disciplineRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Choose Vanguard, Wayfinder, Arcanist, Paladin, Witch Hunter, or Rogue.",
      },
      { status: 400 },
    );
  }

  const store = getGameStore();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ownedCharacter = await getPlayerCharacter(store, player);
    if (!ownedCharacter) {
      return NextResponse.json(
        { error: "Create a character before choosing a discipline." },
        { status: 404 },
      );
    }

    const existingDiscipline = ownedCharacter.character.state.discipline;
    if (
      existingDiscipline &&
      ownedCharacter.character.state.disciplineRevision >=
        CURRENT_DISCIPLINE_REVISION
    ) {
      if (existingDiscipline === parsed.data.discipline) {
        return NextResponse.json({
          character: toProfile(ownedCharacter.id, ownedCharacter.character),
        });
      }
      return NextResponse.json(
        { error: "Your discipline is permanent during the alpha." },
        { status: 409 },
      );
    }

    const nextState = chooseDiscipline(
      ownedCharacter.character.state,
      parsed.data.discipline,
    );
    const committed = await store.commit(
      ownedCharacter.id,
      ownedCharacter.character.version,
      nextState,
    );
    if (committed) {
      return NextResponse.json({
        character: toProfile(ownedCharacter.id, {
          ...ownedCharacter.character,
          state: nextState,
          version: ownedCharacter.character.version + 1,
        }),
      });
    }
  }

  return NextResponse.json(
    { error: "The world shifted beneath you. Try choosing again." },
    { status: 409 },
  );
}
