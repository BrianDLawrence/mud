import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnsiArt } from "@/components/ansi-art";
import { plainAnsi, renderInventory, renderStats } from "./ansi-views";
import { renderAnsiMap } from "./map";
import { chooseDiscipline } from "./disciplines";
import { createInitialCharacterState, executeCommand } from "./engine";
import { parseAnsi } from "./ansi";

const hero = () => chooseDiscipline(createInitialCharacterState(), "vanguard");
const metrics = { hits: 1, intervalMs: 2800, critical: 11, levelFloor: 0, nextLevel: 100 };

describe("ANSI game panels", () => {
  it.each(["map", "inventory", "inv", "i", "stats"])("%s emits an accessible ANSI panel without changing state", (command) => {
    const state = hero();
    const result = executeCommand(state, command);
    expect(result.state).toEqual(state);
    expect(result.messages[0].format).toBe("ansi");
    expect(result.messages[0].label).toBeTruthy();
    const text = plainAnsi(result.messages[0].text);
    expect(text).toContain("╔");
    expect(new Set(text.split("\n").map((line) => [...line].length)).size).toBe(1);
    expect(new Set(parseAnsi(result.messages[0].text).map((run) => run.color)).size).toBeGreaterThan(2);
  });

  it("groups stacks and shows equipped stats without miscounting copies", () => {
    const state = hero();
    state.inventory.push("healing-draught", "healing-draught", "trail-blade-1");
    state.equipment.weapon = "trail-blade-1";
    const text = plainAnsi(renderInventory(state));
    expect(text).toContain("PWR 5  +1 MIG");
    expect(text).toMatch(/\[E\] trail blade 1\s+x1/);
    expect(text).toMatch(/\[ \] healing draught\s+x2/);
    expect(text.match(/healing draught/g)).toHaveLength(1);
    expect(text).toContain(`${state.inventory.length} items`);
    expect(plainAnsi(renderInventory({ ...state, inventory: [], equipment: {}, gold: 0 }))).toContain("Your pack is empty.");
  });

  it("shows exact resource values, gear totals, and within-level XP progress", () => {
    const state = hero();
    state.level = 3; state.experience = 400; state.health = 32;
    state.equipment.weapon = "trail-blade-1";
    const text = plainAnsi(renderStats(state, { ...metrics, levelFloor: 200, nextLevel: 600 }));
    expect(text).toContain("32/64");
    expect(text).toContain("No mana pool");
    expect(text).toMatch(/MIGHT\s+5\s+\+1\s+6/);
    expect(text).toContain("200 XP to level 4");
    expect(text).toMatch(/XP  █{10}░{10}/);
    const max = plainAnsi(renderStats({ ...state, level: 10, experience: 16000 }, { ...metrics, nextLevel: undefined }));
    expect(max).toContain("MAX LEVEL");
    expect(max).not.toContain("NaN");
  });

  it("distinguishes map markers and keeps hidden destinations concealed", () => {
    const state = { ...hero(), roomId: "briar-9", discoveredRoomIds: ["briar-9"] };
    let ansi = renderAnsiMap(state);
    expect(plainAnsi(ansi)).not.toContain("Antler Widow");
    expect(plainAnsi(ansi)).not.toContain("DOWN");
    expect(parseAnsi(ansi).some((run) => run.text.includes("@") && run.backgroundColor === "#55ff55")).toBe(true);
    ansi = renderAnsiMap({ ...state, searchedRoomIds: ["briar-9"] });
    expect(plainAnsi(ansi)).toContain("DOWN -> unexplored");
    expect(plainAnsi(ansi)).not.toContain("Antler Widow");
  });

  it("keeps panel text accessible instead of labeling it as decorative art", () => {
    const html = renderToStaticMarkup(createElement(AnsiArt, { text: renderInventory(hero()), label: "Inventory", readable: true }));
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Inventory"');
    expect(html).not.toContain('role="img"');
    expect(html).toContain("BACKPACK");
  });
});
