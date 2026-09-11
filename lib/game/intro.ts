/** Original 72-column, 16-color ANSI artwork. Unicode equivalents of DOS blocks. */
export const INTRO_DESCRIPTION = "NEXTMUD: First Light. A golden lantern shines beside a moonlit castle and pine forest. Lanternwick: a light against the long night.";
const WIDTH = 72;
const ESC = "\u001b[";
const reset = `${ESC}0m`;
const color = (index: number, background = false) => (index < 8 ? (background ? 40 : 30) : (background ? 100 : 90)) + index % 8;
const ink = (text: string, fg: number, bg = 0) => `${ESC}${color(fg)};${color(bg, true)}m${text}${reset}`;

function scene(): string[] {
  const height = 32;
  const pixels = Array.from({ length: height }, (_, y) => Array<number>(WIDTH).fill(y < 18 ? 0 : 4));
  const pixel = (x: number, y: number, shade: number) => { if (x >= 0 && x < WIDTH && y >= 0 && y < height) pixels[y][x] = shade; };
  const rect = (x: number, y: number, w: number, h: number, shade: number) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) pixel(col, row, shade);
  };
  // Amber moon above distant blue foothills.
  for (let y = 1; y < 17; y++) for (let x = 49; x < 67; x++) {
    const distance = Math.hypot(x - 57, y - 8);
    if (distance < 7) pixel(x, y, distance > 5.8 ? 3 : distance > 4.7 ? 11 : 15);
  }
  for (let x = 0; x < WIDTH; x++) {
    const ridge = Math.floor(19 - Math.sin(x * 0.17) * 3 - Math.cos(x * 0.31) * 2);
    for (let y = ridge; y < height; y++) pixel(x, y, y < ridge + 2 ? 12 : 4);
  }
  // Castle walls, crenellations, towers and a dark arched gateway.
  rect(36, 18, 28, 12, 8);
  rect(38, 20, 24, 10, 7);
  for (const x of [35, 57]) {
    rect(x, 10, 9, 20, 8);
    rect(x + 1, 10, 3, 20, 7);
    for (let t = 0; t < 9; t += 3) rect(x + t, 8, 2, 3, 7);
    rect(x + 3, 14, 2, 4, 0);
    pixel(x + 3, 16, 11);
    rect(x + 3, 23, 2, 3, 0);
  }
  rect(48, 23, 7, 8, 0); rect(49, 21, 5, 3, 0); rect(50, 20, 3, 2, 0);
  // Forest silhouettes and a pale winding road.
  for (const [x, top] of [[2, 12], [10, 17], [18, 14], [68, 16]]) {
    for (let y = top; y < 30; y++) {
      const radius = Math.min(6, Math.floor((y - top) / 3));
      for (let dx = -radius; dx <= radius; dx++) pixel(x + dx, y, dx < 0 ? 2 : 0);
    }
    rect(x, 27, 1, 5, 3);
  }
  for (let y = 29; y < height; y++) for (let x = 47 - (y - 29) * 2; x < 55; x++) pixel(x, y, (x + y) % 3 ? 8 : 7);
  // Foreground lantern: iron hanger, copper housing, bright glass and flame.
  rect(23, 2, 2, 25, 8); rect(23, 2, 10, 2, 7); rect(31, 3, 1, 5, 3);
  rect(27, 8, 10, 2, 3); rect(28, 7, 8, 1, 11);
  rect(27, 10, 10, 13, 3); rect(28, 10, 8, 12, 11);
  rect(29, 11, 6, 10, 3); rect(30, 13, 4, 7, 9);
  rect(31, 12, 2, 8, 11); rect(31, 15, 1, 5, 15);
  rect(27, 22, 10, 2, 3); rect(28, 24, 8, 1, 11);
  const lines: string[] = [];
  for (let y = 0; y < height; y += 2) {
    let line = "", previous = "";
    for (let x = 0; x < WIDTH; x++) {
      const colors = `${color(pixels[y][x])};${color(pixels[y + 1][x], true)}`;
      if (colors !== previous) { line += `${ESC}${colors}m`; previous = colors; }
      line += "▀";
    }
    lines.push(line + reset);
  }
  return lines;
}

const glyphs: Record<string, string[]> = {
  N: ["██  █", "███ █", "█ █ █", "█ ███", "█  ██"],
  E: ["█████", "█    ", "████ ", "█    ", "█████"],
  X: ["█   █", " █ █ ", "  █  ", " █ █ ", "█   █"],
  T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "],
  M: ["█   █", "██ ██", "█ █ █", "█   █", "█   █"],
  U: ["█   █", "█   █", "█   █", "█   █", " ███ "],
  D: ["████ ", "█   █", "█   █", "█   █", "████ "],
};
const centered = (text: string) => text.padStart(Math.floor((WIDTH + text.length) / 2)).padEnd(WIDTH);
const title = Array.from({ length: 5 }, (_, row) => ink(centered([..."NEXTMUD"].map((letter) => glyphs[letter][row]).join(" ")), [15, 11, 11, 3, 3][row]));
export const INTRO_ART = [
  ink("╔" + "═".repeat(WIDTH - 2) + "╗", 3),
  ...scene(),
  ink("░▒▓" + "═".repeat(WIDTH - 6) + "▓▒░", 3),
  ink(" ".repeat(WIDTH), 0),
  ...title,
  ink(centered("F I R S T   L I G H T"), 14),
  ink(" ".repeat(WIDTH), 0),
  ink(centered("L A N T E R N W I C K"), 11),
  ink(centered("A light against the long night."), 7),
  ink("╚" + "═".repeat(WIDTH - 2) + "╝", 3),
].join("\n");
