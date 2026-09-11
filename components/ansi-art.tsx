import type { CSSProperties } from "react";
import { parseAnsi } from "@/lib/game/ansi";

export function AnsiArt({ text, label = "ANSI artwork", readable = false }: Readonly<{ text: string; label?: string; readable?: boolean }>) {
  const runs = parseAnsi(text);
  const columns = Math.max(1, ...runs.map((run) => run.text).join("").split("\n").map((line) => [...line].length));
  return (
    <div className={`ansi-art-frame${readable ? " ansi-panel-frame" : ""}`} style={{ "--ansi-columns": columns } as CSSProperties}>
      <pre className="ansi-art" role={readable ? "group" : "img"} aria-label={label}>
        {runs.map((run, index) => (
          <span key={index} style={{ color: run.color, backgroundColor: run.backgroundColor }}>{run.text}</span>
        ))}
      </pre>
    </div>
  );
}
