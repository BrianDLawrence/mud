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

export const disciplineIds = ["vanguard", "wayfinder", "arcanist"] as const;
export type DisciplineId = (typeof disciplineIds)[number];

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
}

export interface CharacterState {
  roomId: string;
  discipline?: DisciplineId;
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
}

export interface CharacterProfile {
  id: string;
  name: string;
  discipline?: DisciplineId;
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
