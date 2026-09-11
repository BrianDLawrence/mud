import { describe, expect, it } from "vitest";
import { chooseDiscipline } from "./disciplines";
import { createInitialCharacterState, executeCommand } from "./engine";
import { matchingTargets } from "./command-resolution";
import { renderMap } from "./map";
import { firstLightWorld } from "./world";

const hero = () => chooseDiscipline(createInitialCharacterState(), "vanguard");
const run = (command: string, roomId = "drowned-orchard") => executeCommand({ ...hero(), roomId }, command, { nowMs: 1000 });

describe("command abbreviations", () => {
  it.each(["a c", "a m", "A M C", "atk cra", "att marsh", "attack crawler", "attack marsh crawler", "attack marsh-crawler", "a"])("%s attacks the crawler", (command) => {
    expect(run(command)).toEqual(run("attack marsh crawler"));
  });

  it("buys a unique partial item name and preserves full names", () => {
    const state = { ...hero(), roomId: "market-lane", gold: 100 };
    const abbreviated = executeCommand(state, "b blade 1");
    expect(abbreviated).toEqual(executeCommand(state, "buy trail blade 1"));
    expect(abbreviated.state.gold).toBe(70);
    expect(abbreviated.state.inventory).toContain("trail-blade-1");
  });

  it("lists ambiguous purchases without spending gold or choosing a tier", () => {
    const state = { ...hero(), roomId: "market-lane", gold: 100 };
    const result = executeCommand(state, "b blade");
    expect(result.state).toEqual(state);
    expect(result.messages[0].text).toContain("Which do you mean?");
    expect(result.messages[0].text).toContain("trail blade 1");
    expect(result.messages[0].text).toContain("trail blade 5");
    expect(executeCommand(state, "buy").state.gold).toBe(100);
  });

  it("supports NPCs, quests, gear, supplies, and spells", () => {
    expect(run("t k", "lantern-inn")).toEqual(run("talk keeper", "lantern-inn"));
    expect(run("ac black r", "lantern-inn").state.quests[0]?.questId).toBe("beneath-black-roots");
    expect(run("x tra", "rusted-gate").messages[0].text).toContain("Which do you mean?");
    expect(run("x trac", "rusted-gate").messages[0].text).toContain("three-legged");
    let state = { ...hero(), inventory: [...hero().inventory, "trail-blade-1", "healing-draught", "healing-draught"], health: 20 };
    state = executeCommand(state, "equip blade 1").state;
    expect(state.equipment.weapon).toBe("trail-blade-1");
    expect(executeCommand(state, "uneq w").state.equipment.weapon).toBeUndefined();
    expect(executeCommand(state, "use heal").state.health).toBe(60);
    const mage = { ...chooseDiscipline(createInitialCharacterState(), "arcanist"), roomId: "drowned-orchard" };
    expect(executeCommand(mage, "c e m", { nowMs: 1000 })).toEqual(executeCommand(mage, "cast ember crawler", { nowMs: 1000 }));
  });

  it("keeps directions and social content unchanged", () => {
    expect(run("n", "lantern-inn").state.roomId).toBe("rusted-gate");
    expect(run("s").state.roomId).toBe("rusted-gate");
    expect(run("say a m").messages[0].text).toContain("a m");
    expect(run("st").messages[0].text).toContain("Ambiguous command");
  });

  it("does not target absent creatures, unstocked items or empty packs", () => {
    expect(run("a c", "lantern-inn").state.combat).toBeUndefined();
    expect(run("b blade 1", "apothecary").state.gold).toBe(15);
    expect(run("equip blade 5").state.equipment.weapon).toBe("lantern-blade");
  });

  it("exact names win and ambiguous creature prefixes retain all choices", () => {
    const targets = [{ id: "crawler", name: "marsh crawler", aliases: ["crawler"] }, { id: "moth", name: "marsh moth" }];
    expect(matchingTargets("m", targets)).toHaveLength(2);
    expect(matchingTargets("marsh c", targets)).toEqual([targets[0]]);
    expect(matchingTargets("crawler", targets)).toEqual([targets[0]]);
  });
});

describe("paper map", () => {
  it("shows the current position and frontier without exposing unexplored names", () => {
    const map = renderMap(hero());
    expect(map).toContain("LANTERNWICK / SURFACE");
    expect(map).toContain("[ @ ]-------[ ? ]");
    expect(map).toContain("The Copper Lantern");
    expect(map).not.toContain("Market Lane");
    expect(map).not.toContain("Rusted Gate");
    expect(map).not.toContain("Briarwood");
    expect(new Set(map.split("\n").map((line) => line.length)).size).toBe(1);
  });

  it("draws north above south and east to the right with a room key", () => {
    const map = renderMap({ ...hero(), discoveredRoomIds: ["lantern-inn", "rusted-gate", "market-lane", "town-square", "apothecary"] });
    expect(map).toContain("[ @ ]-------[03 ]-------[04 ]");
    expect(map).toContain("01  The Rusted Gate");
    expect(map).toContain("03  Market Lane");
  });

  it("shows discovered stairs without exposing hidden guardians", () => {
    const state = { ...hero(), roomId: "briar-9", discoveredRoomIds: ["briar-9"] };
    expect(renderMap(state)).not.toContain("DOWN");
    const searched = executeCommand(state, "search").state;
    expect(renderMap(searched)).toContain("DOWN -> unexplored");
    expect(renderMap(searched)).not.toContain("Antler Widow");
    const below = executeCommand(searched, "down").state;
    expect(renderMap(below)).toContain("BRIARWOOD / UNDERGROUND");
    expect(renderMap(below)).toContain("UP -> Wolfs Den");
  });

  it("keeps a fully explored world on one local page", () => {
    const state = { ...hero(), roomId: "briar-0", discoveredRoomIds: firstLightWorld.rooms.map((r) => r.id) };
    const map = renderMap(state);
    expect(map).toContain("Thorn Threshold");
    expect(map).not.toContain("Hollow Regent");
    expect(map.split("\n").length).toBeLessThan(60);
    expect(executeCommand(state, "map").messages[0].tone).toBe("map");
  });

  it("has distinct map coordinates and cardinal paths aligned with exits", () => {
    const positions = firstLightWorld.rooms.map((r) => JSON.stringify(r.mapPosition));
    expect(new Set(positions).size).toBe(positions.length);
    for (const room of firstLightWorld.rooms) {
      const p = room.mapPosition!;
      for (const [direction, id] of Object.entries({ ...room.exits, ...room.hiddenExits })) {
        const q = firstLightWorld.rooms.find((r) => r.id === id)!.mapPosition!;
        if (direction === "north") expect(q.y).toBeGreaterThan(p.y);
        if (direction === "south") expect(q.y).toBeLessThan(p.y);
        if (direction === "east") expect(q.x).toBeGreaterThan(p.x);
        if (direction === "west") expect(q.x).toBeLessThan(p.x);
        if (direction === "up") expect(q.z).toBeGreaterThan(p.z);
        if (direction === "down") expect(q.z).toBeLessThan(p.z);
      }
    }
  });
});
