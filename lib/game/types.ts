export const messageTones = [
  "system",
  "location",
  "narrative",
  "exits",
  "speech",
  "combat",
  "experience",
  "presence",
  "status",
  "error",
] as const;

export type MessageTone = (typeof messageTones)[number];

export const disciplineIds = [
  "vanguard",
  "wayfinder",
  "arcanist",
  "paladin",
  "witchhunter",
  "rogue",
] as const;
export type DisciplineId = (typeof disciplineIds)[number];

export const armorWeights = ["light", "medium", "heavy"] as const;
export type ArmorWeight = (typeof armorWeights)[number];

export interface CharacterAttributes {
  might: number;
  agility: number;
  intellect: number;
  vitality: number;
}

export type EquipmentSlot = "weapon" | "armor" | "focus";

export interface CharacterEquipment {
  weapon?: string;
  armor?: string;
  focus?: string;
}

export interface LootDrop {
  roomId: string;
  itemIds: string[];
}

export interface QuestProgress {
  questId: string;
  status: "active" | "completed";
}

export interface GameMessage {
  tone: MessageTone;
  text: string;
}

export interface ActiveCombat {
  creatureId: string;
  roomId: string;
  health: number;
  playerAttacking: boolean;
  nextPlayerAttackAt: number;
  nextCreatureAttackAt: number;
  sequence: number;
}

export interface CharacterState {
  roomId: string;
  discipline?: DisciplineId;
  disciplineRevision: number;
  attributes: CharacterAttributes;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  experience: number;
  level: number;
  inventory: string[];
  equipment: CharacterEquipment;
  groundLoot: LootDrop[];
  quests: QuestProgress[];
  deathCount: number;
  defeatedCreatureIds: string[];
  guarding?: boolean;
  aiming?: boolean;
  sneaking?: boolean;
  combat?: ActiveCombat;
}

export interface CommandResult {
  state: CharacterState;
  messages: GameMessage[];
}

export interface StoredCharacter {
  name: string;
  state: CharacterState;
  version: number;
}

export interface CharacterSummary {
  discipline?: DisciplineId;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  experience: number;
  level: number;
  inCombat: boolean;
  attacking: boolean;
}

export interface CharacterProfile {
  id: string;
  name: string;
  discipline?: DisciplineId;
  disciplineSelectionRequired: boolean;
  summary: CharacterSummary;
}

export const roomEventTypes = [
  "presence.entered",
  "presence.left",
  "chat.say",
  "chat.emote",
] as const;

export type RoomEventType = (typeof roomEventTypes)[number];

export interface RoomEventView {
  id: string;
  type: RoomEventType;
  tone: MessageTone;
  text: string;
  occurredAt: string;
}
