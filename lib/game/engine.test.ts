import { describe, expect, it } from "vitest";
import {
  advanceCombat,
  attacksPerVolley,
  createInitialCharacterState,
  criticalChance,
  executeCommand,
  magicHealingReceived,
  playerAttackIntervalMs,
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

function fightUntilDefeated(
  state: CharacterState,
  target: string,
  command = `attack ${target}`,
): CharacterState {
  let nowMs = 10_000;
  let current = executeCommand(state, command, { nowMs }).state;
  for (let count = 0; count < 12; count += 1) {
    if (!current.combat) return current;
    nowMs += 10_000;
    const result = advanceCombat(current, nowMs);
    current = result.state;
    if (!current.combat) return current;
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

  it("adds Paladin, Witch Hunter, and Rogue with appropriate armor kits", () => {
    const paladin = adventurer("paladin");
    const witchHunter = adventurer("witchhunter");
    const rogue = adventurer("rogue");

    expect(paladin.equipment).toMatchObject({
      weapon: "sunward-mace",
      armor: "sunward-mail",
    });
    expect(paladin.maxMana).toBeGreaterThan(0);
    expect(witchHunter.equipment.armor).toBe("hexhide-coat");
    expect(witchHunter.maxMana).toBe(0);
    expect(magicHealingReceived(witchHunter, 14)).toBe(7);
    expect(rogue.equipment).toMatchObject({
      weapon: "gutter-knife",
      armor: "nightweave-vest",
    });
    expect(rogue.attributes.agility).toBe(7);
  });

  it("offers pre-expansion characters one discipline reselection", () => {
    const legacyState = {
      ...adventurer("vanguard"),
      disciplineRevision: undefined,
    };
    const oldVanguard = normalizeCharacterState(
      legacyState as unknown as CharacterState,
    );
    expect(oldVanguard.disciplineRevision).toBe(1);
    const rebound = chooseDiscipline(oldVanguard, "rogue");

    expect(rebound.discipline).toBe("rogue");
    expect(rebound.disciplineRevision).toBe(2);
    expect(chooseDiscipline(rebound, "paladin")).toEqual(rebound);
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

    const firstAttack = executeCommand(atCrawler, "attack crawler", {
      nowMs: 1_000,
    });
    expect(firstAttack.state.combat?.health).toBe(4);
    expect(firstAttack.state.health).toBe(64);

    const retaliation = advanceCombat(firstAttack.state, 3_600);
    expect(retaliation.state.health).toBe(63);
    expect(retaliation.state.combat?.health).toBe(4);

    const secondVolley = advanceCombat(retaliation.state, 3_800);
    expect(secondVolley.state.combat).toBeUndefined();
    expect(secondVolley.state.experience).toBe(30);
    expect(secondVolley.state.defeatedCreatureIds).toContain("marsh-crawler");

    const looted = executeCommand(secondVolley.state, "loot");
    expect(looted.state.inventory).toContain("crawler-chitin");
    const equipped = executeCommand(looted.state, "equip crawler chitin");
    expect(equipped.state.equipment.armor).toBe("crawler-chitin");
  });

  it("gives each discipline a distinct combat ability", () => {
    const wayfinder = travel(adventurer("wayfinder"), "north", "north");
    const aimed = executeCommand(wayfinder, "aim").state;
    const arrow = executeCommand(aimed, "attack crawler", { nowMs: 1_000 });
    expect(arrow.state.defeatedCreatureIds).toContain("marsh-crawler");

    const arcanist = travel(adventurer("arcanist"), "north", "north");
    const ember = executeCommand(arcanist, "cast ember crawler");
    expect(ember.state.defeatedCreatureIds).toContain("marsh-crawler");
    expect(ember.state.mana).toBe(22);

    const vanguard = executeCommand(adventurer(), "guard");
    expect(vanguard.state.guarding).toBe(true);
  });

  it("uses agility for one, two, or three attacks and critical chance", () => {
    expect(attacksPerVolley(2)).toBe(1);
    expect(attacksPerVolley(5)).toBe(2);
    expect(attacksPerVolley(7)).toBe(3);
    expect(playerAttackIntervalMs(7)).toBeLessThan(playerAttackIntervalMs(2));
    expect(criticalChance(7)).toBeGreaterThan(criticalChance(2));

    const atBoss = travel(adventurer("rogue"), "north", "north", "down");
    const quickVolley = executeCommand(atBoss, "attack keeper", { nowMs: 1_000 });
    expect(quickVolley.messages.filter((entry) => entry.text.includes("You strike"))).toHaveLength(3);
    expect(quickVolley.messages.some((entry) => entry.text.includes("CRITICAL"))).toBe(true);

    const rogue = travel(adventurer("rogue"), "north", "north");
    const hidden = executeCommand(rogue, "sneak").state;
    const backstab = executeCommand(hidden, "backstab crawler", {
      nowMs: 1_000,
    });
    expect(backstab.state.defeatedCreatureIds).toContain("marsh-crawler");
    expect(backstab.messages[0]?.text).toContain("CRITICAL");
  });

  it("lets Paladins use minor holy magic", () => {
    const paladin = travel(adventurer("paladin"), "north", "north");
    const smite = executeCommand(paladin, "smite crawler", { nowMs: 1_000 });
    expect(smite.state.mana).toBe(paladin.mana - 4);
    expect(smite.state.combat).toBeDefined();

    const wounded = { ...smite.state, health: smite.state.maxHealth - 10 };
    const prayer = executeCommand(wounded, "pray");
    expect(prayer.state.health).toBe(prayer.state.maxHealth);
    expect(prayer.state.mana).toBe(smite.state.mana - 6);
  });

  it("applies Witch Hunter magic resistance but not armor to magic damage", () => {
    const witchHunter = travel(adventurer("witchhunter"), "north", "north", "down");
    const started = executeCommand(witchHunter, "attack keeper", { nowMs: 1_000 });
    const stopped = executeCommand(started.state, "stop");
    const struck = advanceCombat(stopped.state, 3_400);

    expect(struck.state.health).toBe(witchHunter.health - 3);
    expect(struck.messages.some((entry) => entry.text.includes("resist 60%"))).toBe(true);
  });

  it("stops player attacks while the enemy keeps attacking", () => {
    const atCrawler = travel(adventurer(), "north", "north");
    const started = executeCommand(atCrawler, "attack crawler", { nowMs: 1_000 });
    const stopped = executeCommand(started.state, "stop");
    const enemyTurn = advanceCombat(stopped.state, 3_600);

    expect(stopped.state.combat?.playerAttacking).toBe(false);
    expect(enemyTurn.state.combat?.health).toBe(4);
    expect(enemyTurn.state.health).toBe(63);
    expect(enemyTurn.state.combat?.playerAttacking).toBe(false);
  });

  it("runs the first quest through its boss and reaches level three", () => {
    let state = adventurer();
    expect(executeCommand(state, "talk keeper").messages.at(-1)?.text).toContain(
      "ACCEPT",
    );
    state = executeCommand(state, "accept orchard").state;
    state = travel(state, "north", "north");
    state = fightUntilDefeated(state, "crawler");
    state = travel(state, "down");
    state = fightUntilDefeated(state, "rootbound-keeper", "attack keeper");
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
    const started = executeCommand(wounded, "attack keeper", { nowMs: 1_000 });
    const result = advanceCombat(started.state, 3_400);

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
