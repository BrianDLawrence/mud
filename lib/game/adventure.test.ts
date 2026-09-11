import { describe, expect, it } from "vitest";
import { advanceCombat, createInitialCharacterState, executeCommand, XP_THRESHOLDS } from "./engine";
import { chooseDiscipline, deriveMaxHealth, deriveMaxMana } from "./disciplines";
import { effectiveAttributes } from "./items";
import { firstLightWorld } from "./world";
import { disciplineIds } from "./types";

const hero = () => chooseDiscipline(createInitialCharacterState(), "vanguard");

describe("expanded adventure", () => {
  it("connects every room including hidden refuges and has five regions", () => {
    const seen = new Set<string>();
    const queue = [firstLightWorld.entryRoomId];
    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const room = firstLightWorld.rooms.find((r) => r.id === id)!;
      queue.push(...Object.values({ ...room.exits, ...room.hiddenExits }));
    }
    expect(seen.size).toBe(firstLightWorld.rooms.length);
    expect(seen.size).toBeGreaterThanOrEqual(60);
    expect(firstLightWorld.rooms.filter((r) => Object.keys(r.hiddenExits).length)).toHaveLength(5);
  });

  it("reveals hidden exits only after search and persists the discovery", () => {
    let state = { ...hero(), roomId: "briar-9" };
    expect(executeCommand(state, "down").state.roomId).toBe("briar-9");
    state = executeCommand(state, "search").state;
    expect(executeCommand(state, "down").state.roomId).toBe("briar-boss");
    expect(state.searchedRoomIds).toContain("briar-9");
  });

  it("respawns creatures at the deadline without erasing quest history", () => {
    let state = { ...hero(), roomId: "drowned-orchard" };
    state = executeCommand(state, "attack crawler", { nowMs: 1000 }).state;
    state = advanceCombat(state, 4000).state;
    const deadline = state.respawnAt["marsh-crawler"];
    expect(deadline).toBeGreaterThan(4000);
    expect(executeCommand(state, "attack crawler", { nowMs: deadline - 1 }).state.combat).toBeUndefined();
    state = executeCommand(state, "attack crawler", { nowMs: deadline }).state;
    expect(state.combat || state.experience > 30).toBeTruthy();
    expect(state.defeatedCreatureIds).toContain("marsh-crawler");
  });

  it("trades, equips and removes bonuses without duplication", () => {
    let state = { ...hero(), roomId: "market-lane", gold: 100 };
    state = executeCommand(state, "buy trail blade 1").state;
    expect(state.gold).toBe(70);
    state = executeCommand(state, "equip trail blade 1").state;
    expect(effectiveAttributes(state).might).toBe(6);
    state = executeCommand(state, "equip trail blade 1").state;
    expect(effectiveAttributes(state).might).toBe(6);
    expect(executeCommand(state, "sell trail blade 1").state.gold).toBe(70);
    state = executeCommand(state, "unequip weapon").state;
    expect(effectiveAttributes(state).might).toBe(5);
    state = executeCommand(state, "sell trail blade 1").state;
    expect(state.gold).toBe(80);
    expect(state.inventory).not.toContain("trail-blade-1");
    expect(executeCommand({ ...state, gold: 0 }, "buy trail blade 5").state.gold).toBe(0);
  });

  it.each(disciplineIds)("%s can solo every region with the previous tier's equipment", (discipline) => {
    for (const [index, area] of ["orchard", "briar", "quarry", "abbey", "crown"].entries()) {
      const level = index * 2 + 2;
      let state = chooseDiscipline(createInitialCharacterState(), discipline);
      state.level = level;
      state.experience = XP_THRESHOLDS[level - 1];
      state.maxHealth = state.health = deriveMaxHealth(state.attributes, level);
      state.maxMana = state.mana = deriveMaxMana(state.attributes, level);
      if (index > 0) {
        for (const [slot, kind] of [["weapon", "blade"], ["armor", "armor"], ["focus", "focus"]] as const) {
          const id = `trail-${kind}-${index}`;
          state.inventory.push(id);
          state.equipment[slot] = id;
        }
      }
      state.roomId = `${area}-boss`;
      state = executeCommand(state, "attack boss", { nowMs: 1000 }).state;
      for (let tick = 1; state.combat && tick < 100; tick++) state = advanceCombat(state, 1000 + tick * 3000).state;
      expect(state.deathCount, `${discipline} in ${area}`).toBe(0);
      expect(state.defeatedCreatureIds).toContain(`${area}-guardian`);
    }
  });
});

it("offers the next quest and turns in later guardians exactly once", () => {
  let state = hero();
  for (const quest of firstLightWorld.quests) {
    state = executeCommand(state, `accept ${quest.id}`).state;
    state.defeatedCreatureIds.push(quest.objective.creatureId);
    const before = state.experience;
    state = executeCommand(state, "talk keeper").state;
    expect(state.quests.find((p) => p.questId === quest.id)?.status).toBe("completed");
    expect(state.experience).toBe(before + quest.reward.experience);
    expect(executeCommand(state, "talk keeper").state.experience).toBe(state.experience);
  }
});

it("repeated encounters can carry a solo character to level ten", () => {
  let state = hero();
  state.level = 9;
  state.experience = XP_THRESHOLDS[8];
  state.maxHealth = state.health = 112;
  state.equipment = { weapon: "trail-blade-4", armor: "trail-armor-4" };
  state.inventory.push("trail-blade-4", "trail-armor-4");
  state.roomId = "crown-0";
  for (let round = 0; round < 20; round++) {
    state.health = state.maxHealth;
    const nowMs = 1000 + round * 300000;
    state = executeCommand(state, "attack creature", { nowMs }).state;
    for (let tick = 1; state.combat && tick < 100; tick++) state = advanceCombat(state, nowMs + tick * 3000).state;
    expect(state.deathCount).toBe(0);
  }
  expect(state.level).toBe(10);
  expect(state.experience).toBe(16000);
});
