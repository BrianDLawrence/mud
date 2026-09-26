import { describe, expect, it } from "vitest";
import { normalizeCharacterState } from "./character-state";
import { chooseDiscipline } from "./disciplines";
import { createInitialCharacterState, executeCommand } from "./engine";
import { plainAnsi, renderEquipment, renderInventory } from "./ansi-views";
import { effectiveAttributes, equipmentArmor, grantItems, receiveItems } from "./items";
import { applyDamage } from "./mortality";
import type { CharacterState } from "./types";

const hero = () => chooseDiscipline(createInitialCharacterState(), "vanguard");

describe("expanded inventory", () => {
  it("equips twelve slots, keeps spare copies in the pack, and supports both rings", () => {
    let state = grantItems(hero(), ["trail-helm", "trail-gloves", "trail-belt", "trail-greaves-1",
      "trail-boots-1", "waystone-pendant", "copper-signet", "copper-signet"]);
    for (const name of ["trail helm", "trail gloves", "trail belt", "trail greaves 1", "trail boots 1", "waystone pendant", "copper signet"]) {
      state = executeCommand(state, `equip ${name}`).state;
    }
    state = executeCommand(state, "equip copper signet ring2").state;
    expect(state.equipment.ring1?.uid).not.toBe(state.equipment.ring2?.uid);
    expect(Object.keys(state.equipment)).toHaveLength(11);
    expect(effectiveAttributes(state).might).toBe(hero().attributes.might + 3);
    expect(plainAnsi(renderInventory(state))).toMatch(/three copper coins\s+x1/);
    const equipped = plainAnsi(renderEquipment(state));
    for (const slot of ["HEAD", "NECK", "BACK", "CHEST", "MAIN", "OFF", "HANDS", "BELT", "RING 1", "RING 2", "LEGS", "FEET"]) expect(equipped).toContain(slot);
    const compact = plainAnsi(renderInventory(state, true));
    expect(Math.max(...compact.split("\n").map((line) => [...line].length))).toBeLessThanOrEqual(38);
    state = executeCommand(state, "unequip ring2").state;
    expect(state.equipment.ring2).toBeUndefined();
    expect(plainAnsi(renderInventory(state))).toMatch(/copper signet\s+x1/);
  });

  it("a two hand staff clears both hands and never doubles its bonus", () => {
    let state = grantItems(chooseDiscipline(createInitialCharacterState(), "arcanist"), ["trail-focus-1"]);
    expect(state.equipment.mainHand?.uid).toBe(state.equipment.offHand?.uid);
    expect(equipmentArmor(state.equipment)).toBe(1);
    state = executeCommand(state, "equip trail focus 1").state;
    expect(state.equipment.mainHand).toBeUndefined();
    expect(state.equipment.offHand?.itemId).toBe("trail-focus-1");
    state = executeCommand(state, "equip ash staff").state;
    expect(state.equipment.mainHand?.uid).toBe(state.equipment.offHand?.uid);
    expect(plainAnsi(renderInventory(state))).toMatch(/trail focus 1\s+x1/);
    state = executeCommand(state, "unequip offHand").state;
    expect(state.equipment.mainHand).toBeUndefined();
    expect(state.equipment.offHand).toBeUndefined();
  });

  it("sells an unequipped duplicate while retaining the worn copy", () => {
    let state = grantItems({ ...hero(), roomId: "market-lane" }, ["trail-blade-1", "trail-blade-1"]);
    state = executeCommand(state, "equip trail blade 1").state;
    const worn = state.equipment.mainHand?.uid;
    const sold = executeCommand(state, "sell trail blade 1").state;
    expect(sold.equipment.mainHand?.uid).toBe(worn);
    expect(sold.inventory.filter((entry) => entry.itemId === "trail-blade-1")).toHaveLength(1);
    expect(executeCommand(sold, "sell trail blade 1").state.gold).toBe(sold.gold);
  });

  it("migrates legacy gear and preserves the old trail armor total", () => {
    const legacy = { ...hero(), inventory: ["trail-armor-2", "trail-blade-2", "traveler-cloak"],
      equipment: { armor: "trail-armor-2", weapon: "trail-blade-2" }, inventorySeed: undefined,
      nextInventorySerial: undefined } as unknown as CharacterState;
    const state = normalizeCharacterState(legacy, "player-1");
    expect(state.equipment.chest?.itemId).toBe("trail-armor-2");
    expect(state.equipment.legs?.itemId).toBe("trail-greaves-2");
    expect(state.equipment.feet?.itemId).toBe("trail-boots-2");
    expect(equipmentArmor(state.equipment)).toBe(6);
    expect(new Set(state.inventory.map((entry) => entry.uid)).size).toBe(state.inventory.length);
    expect(normalizeCharacterState(state, "player-1").inventory).toEqual(state.inventory);
  });

  it("drops every copy once, then transfers the same identities to the looter", () => {
    const state = grantItems(hero(), ["copper-signet", "copper-signet"]);
    const dead = applyDamage({ ...state, health: 1 }, 17, 1000).state;
    const items = dead.deathDrop!.items;
    expect(items).toHaveLength(state.inventory.length);
    expect(new Set(items.map((entry) => entry.uid)).size).toBe(items.length);
    const received = receiveItems(createInitialCharacterState("other"), items);
    expect(received.inventory).toHaveLength(2 + items.length);
    expect(new Set(received.inventory.map((entry) => entry.uid)).size).toBe(received.inventory.length);
  });
});
