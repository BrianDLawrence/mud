import { parseAnsi } from "@/lib/game/ansi";
import { disciplines } from "@/lib/game/disciplines";
import { effectiveAttributes, equipmentArmor, equipmentPower, getItem, isEquipped, itemName, uniqueEquipped } from "@/lib/game/items";
import type { CharacterState, EquipmentSlot } from "@/lib/game/types";

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

const equipmentPairs: [EquipmentSlot, EquipmentSlot][] = [
  ["head", "neck"], ["back", "chest"], ["mainHand", "offHand"],
  ["hands", "belt"], ["ring1", "ring2"], ["legs", "feet"],
];
const slotLabels: Record<EquipmentSlot, string> = {
  head: "HEAD", neck: "NECK", back: "BACK", chest: "CHEST",
  mainHand: "MAIN", offHand: "OFF", hands: "HANDS", belt: "BELT",
  ring1: "RING 1", ring2: "RING 2", legs: "LEGS", feet: "FEET",
};

function slotText(state: CharacterState, slot: EquipmentSlot, width: number): string {
  const entry = state.equipment[slot];
  const name = entry ? itemName(entry.itemId) : "[ empty ]";
  const limit = width - 9;
  const label = [...name].length > limit ? `${[...name].slice(0, limit - 1).join("")}…` : name;
  const body = `${slotLabels[slot].padEnd(7)} ${label}`.padEnd(width);
  return tint(body.slice(0, 8), 96) + tint(body.slice(8), entry ? 92 : 90);
}

function equipmentRows(state: CharacterState, compact: boolean): string[] {
  const rows = [section("EQUIPPED")];
  const silhouette = ["  ◯  ", " ╱│╲ ", "  │  ", " ╱│╲ ", "  │  ", " ╱ ╲ "];
  for (const [index, [left, right]] of equipmentPairs.entries()) {
    if (compact) {
      rows.push(slotText(state, left, 32), slotText(state, right, 32));
    } else {
      rows.push(slotText(state, left, 27) + tint(silhouette[index], 36) + slotText(state, right, 27));
    }
  }
  rows.push("", tint(`Weapon ${equipmentPower(state.equipment, "weapon")}   Focus ${equipmentPower(state.equipment, "focus")}   Armor ${equipmentArmor(state.equipment)}`, 93));
  const bonuses = uniqueEquipped(state.equipment).map((entry) => getItem(entry.itemId)?.bonuses ?? {});
  const totals = { might: 0, agility: 0, intellect: 0, vitality: 0 };
  for (const bonus of bonuses) for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += bonus[key] ?? 0;
  const bonusText = (keys: (keyof typeof totals)[]) => keys.map((key) =>
    `${key.slice(0, 3).toUpperCase()} ${totals[key] >= 0 ? "+" : ""}${totals[key]}`).join("  ");
  rows.push(...(compact
    ? [tint(`Gear: ${bonusText(["might", "agility"])}`, 93), tint(`      ${bonusText(["intellect", "vitality"])}`, 93)]
    : [tint(`Gear: ${bonusText(["might", "agility", "intellect", "vitality"])}`, 93)]));
  return rows;
}

export function renderEquipment(state: CharacterState, compact = false): string {
  return ansiPanel("EQUIPMENT", [...equipmentRows(state, compact), "",
    ...(compact ? [tint("EQUIP <item> [RING1|RING2]", 96), tint("UNEQUIP <slot>", 96)]
      : [tint("EQUIP <item> [RING1|RING2]   UNEQUIP <slot>", 96)])], compact ? 34 : 59);
}

export function renderInventory(state: CharacterState, compact = false): string {
  const counts = new Map<string, number>();
  for (const entry of state.inventory) {
    if (isEquipped(state.equipment, entry)) continue;
    counts.set(entry.itemId, (counts.get(entry.itemId) ?? 0) + 1);
  }
  const rows = [...(compact
    ? [tint(`GOLD ${state.gold}`, 93), tint(`${state.inventory.length} carried / ${counts.size} pack stacks`, 37)]
    : [tint(`GOLD ${state.gold}`, 93) + tint(`    ${state.inventory.length} carried / ${counts.size} pack stacks`, 37)]), "",
    ...equipmentRows(state, compact), "", section("BACKPACK")];
  if (!counts.size) rows.push(tint("Your pack is empty.", 90));
  for (const [id, count] of [...counts].sort(([a], [b]) => itemName(a).localeCompare(itemName(b)))) {
    const item = getItem(id);
    const color = item?.heal || item?.manaRestore ? 95 : item?.slot ? 97 : 37;
    const suffix = ` x${count}`;
    const available = (compact ? 30 : 53) - suffix.length;
    const name = itemName(id);
    const display = [...name].length > available ? `${[...name].slice(0, available - 1).join("")}…` : name;
    rows.push(tint("• ", 90) + tint(display.padEnd(available), color) + tint(suffix, 93));
  }
  rows.push("", tint("Green: worn   Purple: supplies", 37),
    ...(compact ? [tint("EQUIP <item>   UNEQUIP <slot>", 96), tint("USE <item>", 96)]
      : [tint("EQUIP <item>   UNEQUIP <slot>   USE <item>", 96)]));
  return ansiPanel("INVENTORY / TRAVELER'S PACK", rows, compact ? 34 : 59);
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
