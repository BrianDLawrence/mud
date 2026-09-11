import { getItem } from "@/lib/game/items";
import type { CharacterState } from "@/lib/game/types";
import { firstLightWorld, getRoom } from "@/lib/game/world";

interface Target {
  id?: string;
  name: string;
  aliases?: string[];
}

type Resolution = { verb: string; argument: string } | { error: string };

const aliases: Record<string, string> = {
  a: "attack", atk: "attack", k: "kill", b: "buy", t: "talk",
  x: "examine", c: "cast", bs: "backstab", r: "rest", h: "help",
  uneq: "unequip",
};
const commands = [
  "attack", "kill", "buy", "sell", "use", "equip", "equipment", "unequip",
  "talk", "accept", "examine", "inspect", "cast", "smite", "backstab",
  "look", "title", "map", "search", "shop", "inventory", "quests", "abilities",
  "resistance", "rest", "stats", "stop", "guard", "aim", "sneak", "help",
  "go", "move",
];
// Existing directions, social commands and aliases always keep their meaning.
const reserved = new Set([
  ...commands, "n", "s", "e", "w", "u", "d", "north", "south", "east", "west",
  "up", "down", "l", "i", "inv", "eq", "quest", "ability", "loot", "get", "take",
  "speak", "say", "emote", "em", "who", "?", "signout", "logout", "quit", "clear",
]);

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function abbreviated(query: string, name: string): boolean {
  const tokens = words(query);
  const parts = words(name);
  let index = 0;
  return tokens.length > 0 && tokens.every((token) => {
    while (index < parts.length && !parts[index].startsWith(token)) index++;
    return index++ < parts.length;
  });
}

export function matchingTargets(query: string, candidates: Target[]): Target[] {
  const unique = [...new Map(candidates.map((item) => [item.id ?? item.name, item])).values()];
  const normalized = query.trim().toLowerCase();
  const exact = unique.filter((item) =>
    item.name.toLowerCase() === normalized || item.id?.toLowerCase() === normalized,
  );
  if (exact.length) return exact;
  const aliased = unique.filter((item) => item.aliases?.some((alias) => alias.toLowerCase() === normalized));
  if (aliased.length) return aliased;
  return unique.filter((item) => [item.name, item.id ?? "", ...(item.aliases ?? [])]
    .some((name) => abbreviated(query, name)));
}

export function resolveCommand(state: CharacterState, command: string): Resolution {
  const [token, ...rest] = command.trim().split(/\s+/);
  let verb = token.toLowerCase();
  let argument = rest.join(" ");
  if (aliases[verb]) verb = aliases[verb];
  else if (!reserved.has(verb)) {
    const matches = commands.filter((name) => name.startsWith(verb));
    if (matches.length > 1) return { error: `Ambiguous command "${verb}": ${matches.join(", ")}. Type more letters.` };
    if (matches.length === 1) verb = matches[0];
  }

  const room = getRoom(state.roomId);
  const creatures = room.creatures.filter((creature) => !state.respawnAt[creature.id]);
  const carried = state.inventory.flatMap((id) => { const item = getItem(id); return item ? [item] : []; });
  let targets: Target[] | undefined;
  let spell = "";
  if (["attack", "kill", "smite", "backstab"].includes(verb)) targets = creatures;
  else if (verb === "cast") {
    const [spellToken = "", ...targetTokens] = argument.split(/\s+/);
    if (spellToken && "ember".startsWith(spellToken.toLowerCase())) {
      spell = "ember ";
      argument = targetTokens.join(" ");
      targets = creatures;
    }
  } else if (verb === "buy") targets = room.shop.flatMap((id) => { const item = getItem(id); return item ? [item] : []; });
  else if (["equip", "sell", "use"].includes(verb)) targets = carried;
  else if (verb === "unequip") targets = Object.keys(state.equipment).map((name) => ({ name }));
  else if (["talk", "speak"].includes(verb)) targets = room.npcs;
  else if (verb === "accept") targets = firstLightWorld.quests
    .filter((quest) => room.npcs.some((npc) => npc.id === quest.giverNpcId))
    .map((quest) => ({ ...quest, name: quest.title }));
  else if (["examine", "inspect"].includes(verb)) targets = [...room.features, ...creatures, ...room.npcs, ...carried];

  if (!targets) return { verb, argument };
  // A bare ATTACK can select a sole creature; never infer a purchase or item use.
  const matches = !argument && ["attack", "kill"].includes(verb)
    ? creatures : matchingTargets(argument, targets);
  if (matches.length > 1) {
    return { error: `Which do you mean? ${matches.map((item) => `${item.name}${item.id ? ` (${item.id})` : ""}`).join("; ")}. Type more of the name.` };
  }
  const match = matches[0];
  return { verb, argument: spell + (match ? match.id ?? match.name : argument) };
}
