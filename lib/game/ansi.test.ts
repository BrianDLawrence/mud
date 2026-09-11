import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnsiArt } from "@/components/ansi-art";
import { ANSI_PALETTE, parseAnsi } from "./ansi";
import { INTRO_ART } from "./intro";
import { chooseDiscipline } from "./disciplines";
import { createInitialCharacterState, executeCommand } from "./engine";

const esc = "\u001b[";
describe("ANSI artwork", () => {
  it("renders base and bright foreground/background colors with resets", () => {
    const runs = parseAnsi(`${esc}31;44mA${esc}1mB${esc}22;39;49mC${esc}93;104mD${esc}0mE`);
    expect(runs).toEqual([
      { text: "A", color: ANSI_PALETTE[1], backgroundColor: ANSI_PALETTE[4] },
      { text: "B", color: ANSI_PALETTE[9], backgroundColor: ANSI_PALETTE[4] },
      { text: "C", color: ANSI_PALETTE[7], backgroundColor: ANSI_PALETTE[0] },
      { text: "D", color: ANSI_PALETTE[11], backgroundColor: ANSI_PALETTE[12] },
      { text: "E", color: ANSI_PALETTE[7], backgroundColor: ANSI_PALETTE[0] },
    ]);
  });

  it("preserves block characters, spaces and line breaks; keeps styling local", () => {
    expect(parseAnsi(`${esc}31m▀▄█░▒▓\r\n  X`)[0].text).toBe("▀▄█░▒▓\n  X");
    expect(parseAnsi("plain")[0].color).toBe(ANSI_PALETTE[7]);
    expect(parseAnsi(`${esc}31mR${esc}mplain`)[1].color).toBe(ANSI_PALETTE[7]);
  });

  it("supports reverse video and consumes unsupported extended-color groups", () => {
    expect(parseAnsi(`${esc}31;44;7mA${esc}27mB`).map((run) => run.color)).toEqual([ANSI_PALETTE[4], ANSI_PALETTE[1]]);
    expect(parseAnsi(`${esc}38;2;0;1;7mX`)).toEqual(parseAnsi("X"));
  });

  it("discards cursor, erase-screen, OSC links, control characters and truncated escapes", () => {
    const source = `A${esc}2J${esc}10;10H\u001b]8;;https://example.com\u0007B\u001b]8;;\u001b\\\u0007${esc}31`;
    expect(parseAnsi(source).map((run) => run.text).join("")).toBe("AB");
  });

  it("renders hostile HTML as text and provides an accessible description", () => {
    const html = renderToStaticMarkup(createElement(AnsiArt, { text: `${esc}31m<script>alert(1)</script>`, label: "Test art" }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('aria-label="Test art"');
    expect(html).toContain("color:#aa0000");
  });

  it("produces a rectangular, multicolor intro without leaking escape sequences", () => {
    const runs = parseAnsi(INTRO_ART);
    const plain = runs.map((run) => run.text).join("");
    expect(new Set(plain.split("\n").map((line) => [...line].length))).toEqual(new Set([72]));
    expect(new Set(runs.map((run) => run.color)).size).toBeGreaterThan(6);
    expect(new Set(runs.map((run) => run.backgroundColor)).size).toBeGreaterThan(6);
    expect(plain).not.toContain("\u001b");
    expect(plain).toContain("F I R S T   L I G H T");
  });

  it("lets a player replay the title without changing character state", () => {
    const state = chooseDiscipline(createInitialCharacterState(), "vanguard");
    const result = executeCommand(state, "title");
    expect(result.state).toEqual(state);
    expect(result.messages).toEqual([{ tone: "art", text: INTRO_ART }]);
  });
});
