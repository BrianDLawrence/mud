import { matchingTargets } from "@/lib/game/command-resolution";
import { publishDeath, settleCharacter } from "@/lib/game/character-service";
import { magicHealingReceived, playerAttackIntervalMs } from "@/lib/game/engine";
import { effectiveAttributes, equipmentArmor, equipmentPower, findCarriedItem, itemName } from "@/lib/game/items";
import { aidCharacter, applyDamage, healCharacter } from "@/lib/game/mortality";
import { canNotice, heartbeatRoom } from "@/lib/game/room-service";
import type { RoomOccupant, RoomStore } from "@/lib/game/room-store";
import type { GameStore } from "@/lib/game/store";
import type { CharacterState, GameMessage, StoredCharacter } from "@/lib/game/types";

export interface MultiplayerResult {
  state: CharacterState;
  messages: GameMessage[];
}

const msg = (tone: GameMessage["tone"], text: string): GameMessage => ({ tone, text });

async function commitOwn(
  store: GameStore, id: string, character: StoredCharacter, state: CharacterState,
): Promise<boolean> {
  return store.commit(id, character.version, state);
}

function visibleTargets(occupants: RoomOccupant[], selfId: string, state: CharacterState): RoomOccupant[] {
  const perception = effectiveAttributes(state).intellect;
  return occupants.filter((person) => person.id !== selfId &&
    canNotice(perception, person.sneaking, person.stealthScore));
}

export async function visiblePlayers(
  roomStore: RoomStore, id: string, state: CharacterState,
): Promise<RoomOccupant[]> {
  return visibleTargets(await roomStore.listOccupants(state.roomId), id, state);
}

function matchPlayer(query: string, players: RoomOccupant[]): RoomOccupant[] {
  const matches = matchingTargets(query, players.map((player) => ({ id: player.id, name: player.name })));
  return players.filter((player) => matches.some((match) => match.id === player.id));
}

async function updateTarget(
  store: GameStore,
  roomStore: RoomStore,
  target: RoomOccupant,
  roomId: string,
  transform: (state: CharacterState) => MultiplayerResult | null,
): Promise<{ before: StoredCharacter; result: MultiplayerResult } | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const settled = await settleCharacter(store, roomStore, target.id);
    const before = settled?.character;
    if (!before || before.state.roomId !== roomId) return null;
    const result = transform(before.state);
    if (!result) return null;
    if (await store.commit(target.id, before.version, result.state)) {
      if (result.state.deathDrop?.id !== before.state.deathDrop?.id) {
        await publishDeath(store, roomStore, target.id, { ...before, state: result.state });
      }
      return { before, result };
    }
  }
  return null;
}

export async function handleMultiplayerCommand(
  store: GameStore,
  roomStore: RoomStore,
  actorId: string,
  character: StoredCharacter,
  raw: string,
  nowMs = Date.now(),
): Promise<MultiplayerResult | null> {
  const state = character.state;
  const [token = "", ...tokens] = raw.trim().split(/\s+/);
  const verb = token.toLowerCase();
  let argument = tokens.join(" ");
  const living = (state.lifeState ?? "alive") === "alive";

  if (verb === "pvp") {
    const setting = argument.toLowerCase();
    if (!["on", "off", "status"].includes(setting)) return { state, messages: [msg("status", `PvP is ${state.pvpEnabled ? "ON" : "OFF"}. Type PVP ON or PVP OFF.`)] };
    if (setting === "status") return { state, messages: [msg("status", `PvP is ${state.pvpEnabled ? "ON" : "OFF"}.`)] };
    if (!living) return { state, messages: [msg("error", "You cannot change PvP mode while helpless or dead.")] };
    const next = { ...state, pvpEnabled: setting === "on", pvpConfirmation: undefined };
    if (!await commitOwn(store, actorId, character, next)) throw new Error("Character changed during PvP setting");
    return { state: next, messages: [msg("status", `PvP is now ${setting.toUpperCase()}.`)] };
  }

  if (verb === "no" && state.pvpConfirmation) {
    const next = { ...state, pvpConfirmation: undefined };
    if (!await commitOwn(store, actorId, character, next)) throw new Error("Character changed during PvP confirmation");
    return { state: next, messages: [msg("status", "PvP remains off. Attack cancelled.")] };
  }

  const confirming = verb === "yes" && Boolean(state.pvpConfirmation);
  if (confirming) argument = state.pvpConfirmation!;
  const attacking = ["attack", "a", "kill", "k"].includes(verb) || confirming;
  const aiding = verb === "aid";
  const praying = verb === "pray" && Boolean(argument);
  const itemMatch = verb === "use" ? /^(.+?)\s+on\s+(.+)$/i.exec(argument) : null;
  if (!attacking && !aiding && !praying && !itemMatch) return null;
  if (!living) return { state, messages: [msg("error", "You are helpless or dead.")] };
  const players = await visiblePlayers(roomStore, actorId, state);
  const query = itemMatch ? itemMatch[2] : argument;
  const matches = matchPlayer(query, players);
  if (!matches.length) {
    if (confirming || aiding || praying || itemMatch) return { state, messages: [msg("error", `No visible player named "${query}" is here.`)] };
    return null;
  }
  if (matches.length > 1) return { state, messages: [msg("error", `Which player? ${matches.map((p) => p.name).join(", ")}.`)] };
  const target = matches[0];

  if (attacking) {
    if (!state.pvpEnabled && !confirming) {
      const next = { ...state, pvpConfirmation: target.id };
      if (!await commitOwn(store, actorId, character, next)) throw new Error("Character changed during PvP confirmation");
      return { state: next, messages: [msg("status", `To attack ${target.name}, turn on PvP mode. Turn on PvP and attack? Type YES or NO.`)] };
    }
    if (nowMs < (state.nextPvpAttackAt ?? 0)) return { state, messages: [msg("status", "You are still recovering from your last strike.")] };
    const next = { ...state, pvpEnabled: true, pvpConfirmation: undefined,
      nextPvpAttackAt: nowMs + playerAttackIntervalMs(effectiveAttributes(state).agility), sneaking: undefined };
    if (!await commitOwn(store, actorId, character, next)) throw new Error("Character changed during player attack");
    if (state.sneaking) await heartbeatRoom(roomStore, actorId, character.name, state.roomId, next);
    const rawDamage = 3 + (state.level - 1) + Math.floor(effectiveAttributes(state).might / 2)
      + equipmentPower(state.equipment, "weapon");
    const updated = await updateTarget(store, roomStore, target, state.roomId, (victim) => {
      if (victim.lifeState === "dead" || victim.lifeState === "permadead") return null;
      const damage = Math.max(1, rawDamage - equipmentArmor(victim.equipment));
      const injury = applyDamage({ ...victim, pvpEnabled: true }, damage, nowMs);
      return { state: injury.state, messages: injury.messages };
    });
    if (!updated) return { state: next, messages: [msg("error", `${target.name} is no longer here to strike.`)] };
    const damage = updated.before.state.health - updated.result.state.health;
    await roomStore.appendEvent({ roomId: state.roomId, type: "combat.player", actorId, actorName: character.name,
      tone: "combat", text: `${character.name} strikes ${target.name} for ${damage} damage. ${target.name}: ${updated.result.state.health} HP.` });
    for (const notice of updated.result.messages) {
      await roomStore.appendEvent({ roomId: state.roomId, type: "condition.player", actorId,
        actorName: character.name, tone: notice.tone, text: notice.text, audienceId: target.id });
    }
    return { state: next, messages: [msg("combat", `You strike ${target.name} for ${damage} damage. ${target.name}: ${updated.result.state.health} HP.`)] };
  }

  if (aiding) {
    const updated = await updateTarget(store, roomStore, target, state.roomId, (victim) =>
      victim.lifeState === "dying" ? { state: aidCharacter(victim, nowMs), messages: [] } : null);
    if (!updated) return { state, messages: [msg("error", `${target.name} does not need aid here.`)] };
    await roomStore.appendEvent({ roomId: state.roomId, type: "condition.player", actorId,
      actorName: character.name, tone: "status", text: `${character.name} aids ${target.name}, slowing their decline.` });
    return { state, messages: [msg("status", `You aid ${target.name}. Their HP will rise each 30 seconds until they recover.`)] };
  }

  const item = itemMatch ? findCarriedItem(state, itemMatch[1]) : undefined;
  if (itemMatch && (!item || !item.heal)) return { state, messages: [msg("error", "You need a carried healing item to use on a player.")] };
  if (praying && (state.discipline !== "paladin" || state.mana < 6)) return { state,
    messages: [msg("error", "Only a Paladin with 6 mana can Pray for another player.")] };
  const targetBefore = await store.get(target.id);
  if (!targetBefore || targetBefore.state.roomId !== state.roomId ||
      ["dead", "permadead"].includes(targetBefore.state.lifeState ?? "alive") ||
      targetBefore.state.health >= targetBefore.state.maxHealth) return { state,
        messages: [msg("error", `${target.name} cannot be healed here.`)] };
  const next = { ...state, mana: praying ? state.mana - 6 : state.mana,
    inventory: item ? state.inventory.filter((_, index) => index !== state.inventory.indexOf(item.id)) : state.inventory };
  if (!await commitOwn(store, actorId, character, next)) throw new Error("Character changed during healing");
  async function refundHealing() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await store.get(actorId);
      if (!current) break;
      const refund = { ...current.state,
        mana: praying ? current.state.mana + 6 : current.state.mana,
        inventory: item ? [...current.state.inventory, item.id] : current.state.inventory };
      if (await store.commit(actorId, current.version, refund)) return refund;
    }
    throw new Error("Healing did not reach the target and the resource refund needs recovery");
  }
  const amount = item ? item.heal! : magicHealingReceived(targetBefore.state, 14);
  let updated;
  try {
    updated = await updateTarget(store, roomStore, target, state.roomId, (victim) =>
      ["dead", "permadead"].includes(victim.lifeState ?? "alive") || victim.health >= victim.maxHealth
        ? null : { state: healCharacter(victim, amount), messages: [] });
  } catch (error) {
    await refundHealing();
    throw error;
  }
  if (!updated) {
    const refunded = await refundHealing();
    return { state: refunded, messages: [msg("error", `${target.name} cannot be healed here now. Your resource was returned.`)] };
  }
  const healed = updated.result.state.health - updated.before.state.health;
  await roomStore.appendEvent({ roomId: state.roomId, type: "condition.player", actorId,
    actorName: character.name, tone: "status", text: `${character.name} heals ${target.name} for ${healed} HP.` });
  return { state: next, messages: [msg("status", `You heal ${target.name} for ${healed} HP${item ? ` using ${itemName(item.id)}` : ""}.`)] };
}
