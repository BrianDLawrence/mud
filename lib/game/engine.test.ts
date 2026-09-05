import { describe, expect, it } from "vitest";
import {
  createInitialCharacterState,
  executeCommand,
} from "@/lib/game/engine";
import { normalizeCharacterState } from "@/lib/game/character-state";
import { chooseDiscipline } from "@/lib/game/disciplines";
import type { CharacterState, DisciplineId } from "@/lib/game/types";
import { firstLightWorld } from "@/lib/game/world";

function adventurer(discipline: DisciplineId = "vanguard"): CharacterState {
  return chooseDiscipline(createInitialCharacterState(), discipline);
}

function travel(state: CharacterState, ...commands: string[]): CharacterState {
  return commands.reduce(
    (current, command) => executeCommand(current, command).state,
    state,
  );
}

function attackUntilDefeated(
  state: CharacterState,
  target: string,
  command = `attack ${target}`,
): CharacterState {
  let current = state;
  for (let count = 0; count < 12; count += 1) {
    const result = executeCommand(current, command);
    current = result.state;
    if (current.defeatedCreatureIds.some((id) => target.includes(id) || id.includes(target))) {
      return current;
    }
  }
  throw new Error(`${target} was not defeated.`);
}

describe("world content", () => {
  it("loads a valid starting world with a quest and boss", () => {
    expect(firstLightWorld.entryRoomId).toBe("lantern-inn");
    expect(firstLightWorld.rooms.length).toBeGreaterThanOrEqual(5);
    expect(firstLightWorld.quests[0]?.objective.creatureId).toBe(
      "rootbound-keeper",
    );
  });
});

describe("character progression", () => {
  it("binds a permanent discipline with attributes and starter equipment", () => {
    const state = adventurer("arcanist");

    expect(state.discipline).toBe("arcanist");
    expect(state.attributes.intellect).toBe(5);
    expect(state.maxHealth).toBe(46);
    expect(state.maxMana).toBe(28);
    expect(state.equipment.focus).toBe("ash-staff");
    expect(state.inventory).toContain("ash-staff");
    expect(chooseDiscipline(state, "vanguard")).toEqual(state);
  });

  it("upgrades legacy character snapshots without losing progress", () => {
    const legacy = {
      roomId: "drowned-orchard",
      health: 27,
      maxHealth: 50,
      experience: 18,
      level: 1,
      inventory: ["worn traveler's cloak", "three copper coins"],
      defeatedCreatureIds: ["marsh-crawler"],
    } as unknown as CharacterState;

    const state = normalizeCharacterState(legacy);

    expect(state.health).toBe(27);
    expect(state.experience).toBe(18);
    expect(state.inventory).toEqual(["traveler-cloak", "copper-coins"]);
    expect(state.equipment.armor).toBe("traveler-cloak");
    expect(state.groundLoot).toEqual([]);
    expect(state.discipline).toBeUndefined();
  });
});

describe("command engine", () => {
  it("describes the current room and its quest giver", () => {
    const result = executeCommand(adventurer(), "look");

    expect(result.messages[0]).toEqual({
      tone: "location",
      text: "The Copper Lantern",
    });
    expect(result.messages.some((entry) => entry.text.includes("Keeper Vale"))).toBe(true);
    expect(result.messages.some((entry) => entry.tone === "exits")).toBe(true);
  });

  it("moves through valid exits and rejects invalid ones", () => {
    const north = executeCommand(adventurer(), "north");
    const invalid = executeCommand(adventurer(), "south");

    expect(north.state.roomId).toBe("rusted-gate");
    expect(north.messages[0].text).toBe("The Rusted Gate");
    expect(invalid.state.roomId).toBe("lantern-inn");
    expect(invalid.messages[0].text).toBe("You cannot go south from here.");
  });

  it("examines aliased features", () => {
    const atGate = executeCommand(adventurer(), "north").state;
    const result = executeCommand(atGate, "examine tracks");

    expect(result.messages[0].text).toContain("three-legged");
  });

  it("uses deterministic armor, combat progress, experience, and loot", () => {
    const atCrawler = travel(adventurer(), "north", "north");

    const firstAttack = executeCommand(atCrawler, "attack crawler");
    expect(firstAttack.state.combat?.health).toBe(4);
    expect(firstAttack.state.health).toBe(62);

    const secondAttack = executeCommand(firstAttack.state, "attack crawler");
    expect(secondAttack.state.combat).toBeUndefined();
    expect(secondAttack.state.experience).toBe(30);
    expect(secondAttack.state.defeatedCreatureIds).toContain("marsh-crawler");

    const looted = executeCommand(secondAttack.state, "loot");
    expect(looted.state.inventory).toContain("crawler-chitin");
    const equipped = executeCommand(looted.state, "equip crawler chitin");
    expect(equipped.state.equipment.armor).toBe("crawler-chitin");
  });

  it("gives each discipline a distinct combat ability", () => {
    const wayfinder = travel(adventurer("wayfinder"), "north", "north");
    const aimed = executeCommand(wayfinder, "aim").state;
    const arrow = executeCommand(aimed, "attack crawler");
    expect(arrow.state.combat?.health).toBe(1);

    const arcanist = travel(adventurer("arcanist"), "north", "north");
    const ember = executeCommand(arcanist, "cast ember crawler");
    expect(ember.state.defeatedCreatureIds).toContain("marsh-crawler");
    expect(ember.state.mana).toBe(22);

    const vanguard = executeCommand(adventurer(), "guard");
    expect(vanguard.state.guarding).toBe(true);
  });

  it("runs the first quest through its boss and reaches level three", () => {
    let state = adventurer();
    expect(executeCommand(state, "talk keeper").messages.at(-1)?.text).toContain(
      "ACCEPT",
    );
    state = executeCommand(state, "accept orchard").state;
    state = travel(state, "north", "north");
    state = attackUntilDefeated(state, "crawler");
    state = travel(state, "down");
    state = attackUntilDefeated(state, "rootbound-keeper", "attack keeper");
    expect(state.level).toBe(2);
    expect(executeCommand(state, "quests").messages[0].text).toContain(
      "return to the quest giver",
    );

    state = travel(state, "up", "south", "south");
    const completed = executeCommand(state, "talk keeper");

    expect(completed.state.level).toBe(3);
    expect(completed.state.experience).toBe(200);
    expect(completed.state.inventory).toContain("pale-heart-charm");
    expect(completed.state.quests[0]?.status).toBe("completed");
    expect(completed.messages.some((entry) => entry.text.includes("QUEST COMPLETE"))).toBe(true);
  });

  it("recovers defeated characters at the inn without an XP penalty", () => {
    const atBoss = travel(adventurer(), "north", "north", "down");
    const wounded = { ...atBoss, health: 1, experience: 42 };
    const result = executeCommand(wounded, "attack keeper");

    expect(result.state.roomId).toBe("lantern-inn");
    expect(result.state.health).toBe(32);
    expect(result.state.experience).toBe(42);
    expect(result.state.deathCount).toBe(1);
    expect(result.state.combat).toBeUndefined();
  });

  it("returns useful help for unknown commands", () => {
    const result = executeCommand(adventurer(), "dance wildly");

    expect(result.messages[0].tone).toBe("error");
    expect(result.messages[0].text).toContain("Type HELP");
  });
});
