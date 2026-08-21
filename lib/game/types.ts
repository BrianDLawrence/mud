export const messageTones = [
  "system",
  "location",
  "narrative",
  "exits",
  "speech",
  "combat",
  "experience",
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
  state: CharacterState;
  version: number;
}
