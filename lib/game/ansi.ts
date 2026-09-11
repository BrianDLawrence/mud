/** Classic ANSI SGR colors, in ANSI order (not CP437 byte order). */
export const ANSI_PALETTE = [
  "#000000", "#aa0000", "#00aa00", "#aa5500",
  "#0000aa", "#aa00aa", "#00aaaa", "#aaaaaa",
  "#555555", "#ff5555", "#55ff55", "#ffff55",
  "#5555ff", "#ff55ff", "#55ffff", "#ffffff",
] as const;

export interface AnsiRun {
  text: string;
  color: string;
  backgroundColor: string;
}

/**
 * Static artwork only: SGR 16-color foreground/background, bold-as-bright,
 * inverse and resets. Cursor, screen, link and other terminal controls are
 * discarded. Content stays text; never interpret it as HTML.
 */
export function parseAnsi(source: string): AnsiRun[] {
  let foreground = 7, background = 0, bright = false, inverse = false;
  const runs: AnsiRun[] = [];
  const append = (text: string) => {
    if (!text) return;
    const fg = ANSI_PALETTE[foreground < 8 && bright ? foreground + 8 : foreground];
    const bg = ANSI_PALETTE[background];
    const color = inverse ? bg : fg;
    const backgroundColor = inverse ? fg : bg;
    const last = runs.at(-1);
    if (last?.color === color && last.backgroundColor === backgroundColor) last.text += text;
    else runs.push({ text, color, backgroundColor });
  };
  // Bound source size to keep malformed artwork from creating unbounded DOM.
  const input = source.slice(0, 65536).replace(/\r\n/g, "\n");
  let text = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code === 27) {
      append(text); text = "";
      if (input[i + 1] === "[") {
        let end = i + 2;
        while (end < input.length && !/[\x40-\x7e]/.test(input[end])) end++;
        const parameters = input.slice(i + 2, end);
        if (input[end] === "m" && /^[\d;]*$/.test(parameters)) {
          const values = parameters.split(";").map((part) => Number(part || 0));
          for (let at = 0; at < values.length; at++) {
            const value = values[at];
            if (value === 0) { foreground = 7; background = 0; bright = false; inverse = false; }
            else if (value === 1) bright = true;
            else if (value === 22) bright = false;
            else if (value === 7) inverse = true;
            else if (value === 27) inverse = false;
            else if (value === 39) foreground = 7;
            else if (value === 49) background = 0;
            else if (value >= 30 && value <= 37) foreground = value - 30;
            else if (value >= 40 && value <= 47) background = value - 40;
            else if (value >= 90 && value <= 97) foreground = value - 90 + 8;
            else if (value >= 100 && value <= 107) background = value - 100 + 8;
            // Consume unsupported extended colors as a group, not as SGR flags.
            else if (value === 38 || value === 48) {
              if (values[at + 1] === 5) at += 2;
              else if (values[at + 1] === 2) at += 4;
              else break;
            }
          }
        }
        i = end;
      } else if (["]", "P", "^", "_"].includes(input[i + 1])) {
        // OSC/DCS payloads, including terminal hyperlinks, are never rendered.
        i += 2;
        while (i < input.length && input.charCodeAt(i) !== 7 && !(input.charCodeAt(i) === 27 && input[i + 1] === "\\")) i++;
        if (input.charCodeAt(i) === 27) i++;
      } else {
        i++; // Unsupported two-character escape.
      }
    } else if (code === 10 || code >= 32 && !(code >= 127 && code <= 159)) {
      text += input[i];
    }
  }
  append(text);
  return runs;
}
