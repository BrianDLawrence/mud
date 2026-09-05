import { describe, expect, it } from "vitest";
import { getPlayerCharacter } from "@/lib/game/player-character";
import type { GameStore } from "@/lib/game/store";
import type { StoredCharacter } from "@/lib/game/types";

const character: StoredCharacter = {
  name: "Mira",
  state: {
    roomId: "lantern-inn",
    discipline: "vanguard",
    disciplineRevision: 2,
    attributes: { might: 5, agility: 2, intellect: 1, vitality: 5 },
    health: 20,
    maxHealth: 20,
    mana: 0,
    maxMana: 0,
    experience: 0,
    level: 1,
    inventory: [],
    equipment: {},
    groundLoot: [],
    quests: [],
    deathCount: 0,
    defeatedCreatureIds: [],
  },
  version: 0,
};

function readOnlyStore(
  characters: Record<string, StoredCharacter>,
): GameStore {
  return {
    get: async (id) => characters[id] || null,
    create: async () => ({ created: false, reason: "character_exists" }),
    commit: async () => false,
  };
}

describe("getPlayerCharacter", () => {
  it("prefers the stable Discord-derived owner", async () => {
    const result = await getPlayerCharacter(
      readOnlyStore({ stable: character, legacy: { ...character, name: "Old" } }),
      {
        id: "stable",
        legacyId: "legacy",
        displayName: "Mira",
        source: "web",
      },
    );

    expect(result).toEqual({ id: "stable", character });
  });

  it("finds a character created under the earlier web account ID", async () => {
    const result = await getPlayerCharacter(readOnlyStore({ legacy: character }), {
      id: "stable",
      legacyId: "legacy",
      displayName: "Mira",
      source: "discord-activity",
    });

    expect(result).toEqual({ id: "legacy", character });
  });
});
