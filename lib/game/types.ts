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
  health: number;
  maxHealth: number;
  experience: number;
  level: number;
  inventory: string[];
  defeatedCreatureIds: string[];
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
  health: number;
  maxHealth: number;
  experience: number;
  level: number;
}

export interface CharacterProfile {
  id: string;
  name: string;
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
