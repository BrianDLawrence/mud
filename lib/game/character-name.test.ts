import { describe, expect, it } from "vitest";
import {
  characterNameSchema,
  normalizeCharacterName,
} from "@/lib/game/character-name";

describe("character names", () => {
  it("normalizes names for case-insensitive uniqueness", () => {
    expect(normalizeCharacterName("  Arannis  ")).toBe("arannis");
  });

  it("accepts lore-friendly names", () => {
    expect(characterNameSchema.safeParse("Arannis").success).toBe(true);
    expect(characterNameSchema.safeParse("Kael-Rin").success).toBe(true);
    expect(characterNameSchema.safeParse("O'Brien").success).toBe(true);
  });

  it("rejects invalid and reserved names", () => {
    expect(characterNameSchema.safeParse("a").success).toBe(false);
    expect(characterNameSchema.safeParse("Sir Graphical UI").success).toBe(false);
    expect(characterNameSchema.safeParse("SYSTEM").success).toBe(false);
  });
});
