import { describe, expect, it } from "vitest";
import { createInitialCharacterState, executeCommand } from "@/lib/game/engine";
import { firstLightWorld } from "@/lib/game/world";

describe("world content", () => {
  it("loads a valid starting world", () => {
    expect(firstLightWorld.entryRoomId).toBe("lantern-inn");
    expect(firstLightWorld.rooms.length).toBeGreaterThanOrEqual(4);
  });
});

describe("command engine", () => {
  it("describes the current room", () => {
    const result = executeCommand(createInitialCharacterState(), "look");

    expect(result.messages[0]).toEqual({
      tone: "location",
      text: "The Copper Lantern",
    });
    expect(result.messages.some((entry) => entry.tone === "exits")).toBe(true);
  });

  it("moves through a valid exit", () => {
    const result = executeCommand(createInitialCharacterState(), "north");

    expect(result.state.roomId).toBe("rusted-gate");
    expect(result.messages[0].text).toBe("The Rusted Gate");
  });

  it("rejects an invalid exit without changing rooms", () => {
    const initial = createInitialCharacterState();
    const result = executeCommand(initial, "south");

    expect(result.state.roomId).toBe(initial.roomId);
    expect(result.messages).toEqual([
      { tone: "error", text: "You cannot go south from here." },
    ]);
  });

  it("examines aliased features", () => {
    const atGate = executeCommand(createInitialCharacterState(), "north").state;
    const result = executeCommand(atGate, "examine tracks");

    expect(result.messages[0].text).toContain("three-legged");
  });

  it("persists combat progress and awards experience", () => {
    let state = createInitialCharacterState();
    state = executeCommand(state, "north").state;
    state = executeCommand(state, "north").state;

    const firstAttack = executeCommand(state, "attack crawler");
    expect(firstAttack.state.combat?.health).toBe(6);
    expect(firstAttack.state.health).toBe(47);

    const secondAttack = executeCommand(firstAttack.state, "attack crawler");
    expect(secondAttack.state.combat).toBeUndefined();
    expect(secondAttack.state.experience).toBe(18);
    expect(secondAttack.state.defeatedCreatureIds).toContain("marsh-crawler");
  });

  it("returns useful help for unknown commands", () => {
    const result = executeCommand(createInitialCharacterState(), "dance wildly");

    expect(result.messages[0].tone).toBe("error");
    expect(result.messages[0].text).toContain("Type HELP");
  });
});
