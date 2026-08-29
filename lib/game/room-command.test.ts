import { describe, expect, it } from "vitest";
import { parseRoomCommand } from "@/lib/game/room-command";

describe("parseRoomCommand", () => {
  it("parses room-aware commands without claiming engine commands", () => {
    expect(parseRoomCommand("who")).toEqual({ kind: "who" });
    expect(parseRoomCommand("say  First   light! ")).toEqual({
      kind: "say",
      content: "First light!",
    });
    expect(parseRoomCommand("em nods to Mira")).toEqual({
      kind: "emote",
      content: "nods to Mira",
    });
    expect(parseRoomCommand("north")).toBeNull();
  });

  it("rejects empty, oversized, and control-character social text", () => {
    expect(parseRoomCommand("say")).toEqual({
      kind: "error",
      message: "Say what?",
    });
    expect(parseRoomCommand(`say ${"x".repeat(281)}`)).toEqual({
      kind: "error",
      message: "Messages may not exceed 280 characters.",
    });
    expect(parseRoomCommand("emote waves\u0000")).toEqual({
      kind: "error",
      message: "Messages cannot contain control characters.",
    });
  });
});
