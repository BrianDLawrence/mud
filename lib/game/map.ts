import { ansiPanel, tint } from "@/lib/game/ansi-views";
import type { CharacterState } from "@/lib/game/types";
import { firstLightWorld, getRoom } from "@/lib/game/world";
import type { Room } from "@/lib/game/world-schema";

function knownExits(room: Room, state: CharacterState) {
  return { ...room.exits, ...(state.searchedRoomIds.includes(room.id) ? room.hiddenExits : {}) };
}

/** Draw one page of the journal at a time; only visited rooms reveal their exits. */
export function renderMap(state: CharacterState): string {
  const current = getRoom(state.roomId);
  if (!current.mapPosition) return `No chart exists here yet. You are at ${current.name}.`;
  const visited = new Set([...state.discoveredRoomIds, state.roomId]);
  const local = firstLightWorld.rooms.filter((room) => visited.has(room.id)
    && room.area === current.area && room.mapPosition?.z === current.mapPosition!.z);
  const nodes = new Map(local.map((room) => [room.id, room]));
  const edges: [Room, Room][] = [];
  const stairs: string[] = [];
  for (const room of local) {
    for (const [direction, id] of Object.entries(knownExits(room, state))) {
      const next = getRoom(id);
      if (direction === "up" || direction === "down") {
        stairs.push(`${room.name}: ${direction.toUpperCase()} -> ${visited.has(id) ? next.name : "unexplored"}`);
      } else if (next.mapPosition?.z === current.mapPosition.z) {
        nodes.set(id, next);
        edges.push([room, next]);
      }
    }
  }

  const charted = [...nodes.values()];
  const minX = Math.min(...charted.map((room) => room.mapPosition!.x));
  const maxX = Math.max(...charted.map((room) => room.mapPosition!.x));
  const minY = Math.min(...charted.map((room) => room.mapPosition!.y));
  const maxY = Math.max(...charted.map((room) => room.mapPosition!.y));
  // Short numbered markers keep the chart legible on a narrow terminal.
  const width = (maxX - minX) * 12 + 7;
  const height = (maxY - minY) * 3 + 1;
  const grid = Array.from({ length: height }, () => Array<string>(width).fill(" "));
  const point = (room: Room) => ({ x: (room.mapPosition!.x - minX) * 12 + 3, y: (maxY - room.mapPosition!.y) * 3 });
  for (const [from, to] of edges) {
    const a = point(from), b = point(to);
    if (a.y === b.y) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) grid[a.y][x] = "-";
    if (a.x === b.x) for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) grid[y][a.x] = "|";
  }

  const labels: string[] = [];
  let number = 0;
  for (const room of charted.sort((a, b) => b.mapPosition!.y - a.mapPosition!.y || a.mapPosition!.x - b.mapPosition!.x)) {
    const here = room.id === state.roomId;
    const known = visited.has(room.id);
    const symbol = here ? " @ " : known ? String(++number).padStart(2, "0").padEnd(3) : " ? ";
    const { x, y } = point(room);
    const mark = `[${symbol}]`;
    for (let i = 0; i < mark.length; i++) grid[y][x - 2 + i] = mark[i];
    if (known) {
      const vertical = Object.keys(knownExits(room, state)).filter((d) => d === "up" || d === "down");
      labels.push(`${here ? " @" : symbol.trim()}  ${room.name}${room.area !== current.area ? ` (${room.area})` : ""}${vertical.length ? ` [${vertical.map((d) => d.toUpperCase()).join("/")}]` : ""}`);
    }
  }
  const title = `${current.area.toUpperCase()} / ${current.mapPosition.z < 0 ? "UNDERGROUND" : "SURFACE"}`;
  const lines = [title, "", "       N", "       |", "   W --+-- E", "       |", "       S", "", ...grid.map((line) => line.join("").trimEnd()), "", "@ You   ? Unexplored   -- | Paths", "", ...labels, ...(stairs.length ? ["", ...stairs] : []), "", "MAP charts this area. Travel to turn the page."];
  const pageWidth = Math.max(...lines.map((line) => line.length));
  return ["+" + "-".repeat(pageWidth + 2) + "+", ...lines.map((line) => `| ${line.padEnd(pageWidth)} |`), "+" + "-".repeat(pageWidth + 2) + "+"].join("\n");
}

/** ANSI presentation preserves the discovery rules of the plain map. */
export function renderAnsiMap(state: CharacterState): string {
  const original = renderMap(state);
  if (!original.startsWith("+")) return ansiPanel("EXPLORER'S MAP", [original]);
  const rows = original.split("\n").slice(1, -1).map((line) => line.slice(2, -2).trimEnd());
  const colored = rows.map((line, index) => {
    if (index === 0) return tint(line, 93);
    // Only replace path glyphs in the chart, never in names or directions.
    if (/^[\s\d@?\[\]|+\-]+$/.test(line)) {
      return line.split(/(\[[^\]]+\])/).map((part) => {
        if (part.startsWith("[")) return tint(part, part.includes("@") ? 30 : part.includes("?") ? 37 : 96, part.includes("@") ? 102 : 40);
        return tint(part.replace(/-/g, "─").replace(/\|/g, "│").replace(/\+/g, "┼"), 36);
      }).join("");
    }
    if (line.trimStart().startsWith("@") && !line.includes("Unexplored")) return tint(line, 92);
    if (line.includes("UP") || line.includes("DOWN")) return tint(line, 93);
    if (line.includes("Unexplored")) return tint("@ You   ? Unexplored   ─ │ Paths", 37);
    if (line.includes("MAP charts")) return tint(line, 96);
    return tint(line, 37);
  });
  return ansiPanel("EXPLORER'S MAP", colored, 48);
}
