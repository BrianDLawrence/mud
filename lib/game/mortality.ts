import { normalizeCharacterState } from "@/lib/game/character-state";
import { firstLightWorld } from "@/lib/game/world";
import type { CharacterState, CommandResult } from "@/lib/game/types";

export const MAX_LIVES = 9;
export const CONDITION_TICK_MS = 30_000;

export function livesRemaining(state: CharacterState): number {
  return Math.max(0, MAX_LIVES - state.deathCount);
}

function deathThreshold(state: CharacterState): number {
  return -Math.ceil(state.maxHealth / 4);
}

function finishDeath(state: CharacterState, nowMs: number): CommandResult {
  const deathCount = state.deathCount + 1;
  const permanent = deathCount >= MAX_LIVES;
  const itemIds = [...state.inventory];
  for (const id of Object.values(state.equipment)) {
    if (id && !itemIds.includes(id)) itemIds.push(id);
  }
  const gold = state.gold;
  return {
    state: {
      ...state,
      lifeState: permanent ? "permadead" : "dead",
      deathCount,
      conditionAt: undefined,
      receivingAid: undefined,
      combat: undefined,
      pvpEnabled: false,
      pvpConfirmation: undefined,
      inventory: [],
      equipment: {},
      gold: 0,
      deathDrop: {
        id: `${nowMs}:${deathCount}`,
        roomId: state.roomId,
        itemIds,
        gold,
      },
      deathDropPublishedId: undefined,
    },
    messages: [
      { tone: "combat", text: permanent
        ? "You have died your ninth death. This character's story ends here. Type RECREATE to make a new character."
        : "You have died. Your possessions lie where you fell. Type RESURRECT to return at the Lantern Inn." },
    ],
  };
}

export function applyDamage(current: CharacterState, damage: number, nowMs = Date.now()): CommandResult {
  const state = normalizeCharacterState(current);
  if (state.lifeState === "dead" || state.lifeState === "permadead") {
    return { state, messages: [] };
  }
  const health = state.health - Math.max(0, Math.floor(damage));
  const wounded: CharacterState = {
    ...state,
    health,
    lifeState: health <= 0 ? "dying" : "alive",
    conditionAt: health <= 0 ? (state.lifeState === "dying" ? state.conditionAt ?? nowMs : nowMs) : undefined,
    receivingAid: health <= 0 ? state.receivingAid : undefined,
    combat: health <= 0 ? undefined : state.combat,
  };
  if (health <= deathThreshold(state)) return finishDeath(wounded, nowMs);
  return {
    state: wounded,
    messages: health <= 0 && state.lifeState !== "dying"
      ? [{ tone: "combat", text: `You collapse at ${health} HP. You need aid before you bleed out.` }]
      : [],
  };
}

export function advanceCondition(current: CharacterState, nowMs = Date.now()): CommandResult {
  const state = normalizeCharacterState(current);
  if (state.lifeState !== "dying") return { state, messages: [] };
  const since = state.conditionAt ?? nowMs;
  const ticks = Math.max(0, Math.floor((nowMs - since) / CONDITION_TICK_MS));
  if (!ticks) return { state, messages: [] };
  const step = Math.max(1, Math.ceil(state.maxHealth / 100));
  const health = state.health + ticks * step * (state.receivingAid ? 1 : -1);
  const advanced: CharacterState = { ...state, health, conditionAt: since + ticks * CONDITION_TICK_MS };
  if (health <= deathThreshold(state)) return finishDeath(advanced, nowMs);
  if (health > 0) return {
    state: { ...advanced, lifeState: "alive", conditionAt: undefined, receivingAid: undefined },
    messages: [{ tone: "status", text: "You regain consciousness." }],
  };
  return { state: advanced, messages: [{ tone: "status", text: `You are ${state.receivingAid ? "recovering" : "bleeding out"} at ${health} HP.` }] };
}

export function healCharacter(current: CharacterState, amount: number): CharacterState {
  const state = normalizeCharacterState(current);
  if (state.lifeState === "dead" || state.lifeState === "permadead") return state;
  const health = Math.min(state.maxHealth, state.health + Math.max(0, amount));
  return {
    ...state,
    health,
    lifeState: health > 0 ? "alive" : "dying",
    conditionAt: health > 0 ? undefined : state.conditionAt,
    receivingAid: health > 0 ? undefined : state.receivingAid,
  };
}

export function aidCharacter(current: CharacterState, nowMs = Date.now()): CharacterState {
  const state = normalizeCharacterState(current);
  return state.lifeState === "dying"
    ? { ...state, receivingAid: true, conditionAt: state.conditionAt ?? nowMs }
    : state;
}

export function resurrect(current: CharacterState): CommandResult {
  const state = normalizeCharacterState(current);
  if (state.lifeState !== "dead") return {
    state,
    messages: [{ tone: "error", text: state.lifeState === "permadead"
      ? "This character has no lives remaining. Create a new character to continue."
      : "You are not dead." }],
  };
  return {
    state: {
      ...state,
      roomId: firstLightWorld.entryRoomId,
      health: Math.ceil(state.maxHealth / 2),
      mana: Math.ceil(state.maxMana / 2),
      lifeState: "alive",
      conditionAt: undefined,
      receivingAid: undefined,
      sneaking: undefined,
      combat: undefined,
    },
    messages: [{ tone: "location", text: "You awaken beside the Copper Lantern at the Lantern Inn." },
      { tone: "status", text: `${livesRemaining(state)} lives remain.` }],
  };
}
