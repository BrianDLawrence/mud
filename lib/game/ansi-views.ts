import { parseAnsi } from "@/lib/game/ansi";
import { disciplines } from "@/lib/game/disciplines";
import { effectiveAttributes, equipmentArmor, equipmentPower, getItem, itemName } from "@/lib/game/items";
import type { CharacterState } from "@/lib/game/types";

export const tint = (text: string, foreground = 37, background = 40) => `\u001b[${foreground};${background}m${text}\u001b[0m`;
export const plainAnsi = (text: string) => parseAnsi(text).map((run) => run.text).join("");
const length = (text: string) => [...plainAnsi(text)].length;

export function ansiPanel(title: string, rows: string[], minimumWidth = 56): string {
  const width = Math.max(minimumWidth, length(title) + 2, ...rows.map(length));
  const rule = (left: string, right: string) => tint(left + "═".repeat(width + 2) + right, 36);
  const line = (row: string) => tint("║ ", 36) + row + tint(" ".repeat(width - length(row)) + " ║", 36);
  return [rule("╔", "╗"), line(tint(` ${title} `.padEnd(width), 97, 44)), rule("╠", "╣"), ...rows.map(line), rule("╚", "╝")].join("\n");
}

function section(title: string): string {
  return tint(`── ${title} ──`, 96);
}

function bonuses(id: string): string {
  const item = getItem(id);
  const parts: string[] = [];
  if (item?.power) parts.push(`PWR ${item.power}`);
  if (item?.armor) parts.push(`ARM ${item.armor}`);
  for (const [key, value] of Object.entries(item?.bonuses ?? {})) parts.push(`+${value} ${key.slice(0, 3).toUpperCase()}`);
  return parts.join("  ");
}

export function renderInventory(state: CharacterState): string {
  const counts = new Map<string, number>();
  for (const id of state.inventory) counts.set(id, (counts.get(id) ?? 0) + 1);
  const rows = [tint(`GOLD ${state.gold}`, 93) + tint(`    ${state.inventory.length} items / ${counts.size} stacks`, 37), "", section("EQUIPPED")];
  for (const slot of ["weapon", "armor", "focus"] as const) {
    const id = state.equipment[slot];
    rows.push(tint(slot.toUpperCase().padEnd(8), 96) + (id ? tint(itemName(id), 92) : tint("[ empty ]", 37)));
    if (id && bonuses(id)) rows.push("        " + tint(bonuses(id), 93));
  }
  rows.push("", section("BACKPACK"), tint("    ITEM                                  QTY", 37));
  if (!counts.size) rows.push(tint("Your pack is empty.", 37));
  // Equipped stacks come first, then a stable alphabetical list.
  const equipped = new Set(Object.values(state.equipment));
  const stacks = [...counts].sort(([a], [b]) => Number(equipped.has(b)) - Number(equipped.has(a)) || itemName(a).localeCompare(itemName(b)));
  for (const [id, count] of stacks) {
    const worn = equipped.has(id);
    const item = getItem(id);
    const color = worn ? 92 : item?.heal || item?.manaRestore ? 95 : 37;
    rows.push(tint(worn ? "[E] " : "[ ] ", worn ? 92 : 90) + tint(itemName(id).padEnd(38), color) + tint(`x${count}`, 97));
  }
  rows.push("", tint("[E] equipped  ·  Purple: supplies", 37), tint("EQUIP <item>   UNEQUIP <slot>   USE <item>", 96), tint("SELL <item> at a shop   ·   EQ for equipment", 96));
  return ansiPanel("INVENTORY / TRAVELER'S PACK", rows);
}

function bar(current: number, maximum: number, color: number): string {
  const filled = maximum > 0 ? Math.round(Math.max(0, Math.min(1, current / maximum)) * 20) : 0;
  return tint("█".repeat(filled), color) + tint("░".repeat(20 - filled), 90);
}

export interface StatMetrics {
  hits: number;
  intervalMs: number;
  critical: number;
  levelFloor: number;
  nextLevel?: number;
}

export function renderStats(state: CharacterState, metrics: StatMetrics): string {
  const attributes = effectiveAttributes(state);
  const discipline = state.discipline ? disciplines[state.discipline] : undefined;
  const next = metrics.nextLevel;
  const rows = [tint(`${discipline?.name ?? "Unsworn"}  /  LEVEL ${state.level}`, 97) + tint(`  /  ${state.combat ? "IN COMBAT" : "AT EASE"}`, state.combat ? 91 : 92), "",
    tint("HP  ", 91) + bar(state.health, state.maxHealth, 91) + tint(`  ${state.health}/${state.maxHealth}`, 97),
    tint("MP  ", 96) + bar(state.mana, state.maxMana, 96) + tint(state.maxMana ? `  ${state.mana}/${state.maxMana}` : "  No mana pool", 97),
    tint("XP  ", 93) + bar(next === undefined ? 1 : state.experience - metrics.levelFloor, next === undefined ? 1 : next - metrics.levelFloor, 93) + tint(next === undefined ? `  ${state.experience} / MAX LEVEL` : `  ${state.experience}/${next}`, 97),
    tint(next === undefined ? "Level cap reached." : `${Math.max(0, next - state.experience)} XP to level ${state.level + 1}`, 93), "", section("ATTRIBUTES"),
    tint("ATTRIBUTE".padEnd(18) + "BASE".padStart(5) + "GEAR".padStart(10) + "TOTAL".padStart(10), 37),
  ];
  for (const key of ["might", "agility", "intellect", "vitality"] as const) {
    const bonus = attributes[key] - state.attributes[key];
    rows.push(tint(key.toUpperCase().padEnd(18), 96) + tint(String(state.attributes[key]).padStart(5), 37) + tint((bonus >= 0 ? `+${bonus}` : String(bonus)).padStart(10), bonus ? 92 : 37) + tint(String(attributes[key]).padStart(10), 97));
  }
  rows.push("", section("COMBAT"),
    tint(`${metrics.hits} hit${metrics.hits === 1 ? "" : "s"} / volley   ${(metrics.intervalMs / 1000).toFixed(2)}s interval   ${metrics.critical}% crit`, 97),
    `Weapon power ${equipmentPower(state.equipment, "weapon")}   Focus ${equipmentPower(state.equipment, "focus")}   Armor ${equipmentArmor(state.equipment)}`,
    `Armor training: ${discipline?.armorTraining ?? "none"}`,
    `Magic resistance: ${Math.round((discipline?.magicResistance ?? 0) * 100)}%`,
    "", tint(`GOLD ${state.gold}`, 93) + `    Deaths ${state.deathCount}`, "",
    tint("Might: damage   Agility: speed, volleys, crits", 37),
    tint("Intellect: spells   Vitality: starting health", 37),
    tint("Per level: +6 HP, +1 physical damage", 37),
    tint("Mana users also gain +4 MP per level.", 37));
  return ansiPanel("CHARACTER / STATS", rows);
}
