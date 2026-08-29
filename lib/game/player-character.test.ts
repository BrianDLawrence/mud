import { describe, expect, it } from "vitest";
import { getPlayerCharacter } from "@/lib/game/player-character";
import type { GameStore } from "@/lib/game/store";
import type { StoredCharacter } from "@/lib/game/types";

const character: StoredCharacter = {
  name: "Mira",
  state: {
    roomId: "lantern-inn",
    health: 20,
    maxHealth: 20,
    experience: 0,
    level: 1,
    inventory: [],
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
