export const messageTones = [
  "map",
  "art",
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

export const equipmentSlots = [
  "head", "neck", "back", "chest", "hands", "belt",
  "legs", "feet", "mainHand", "offHand", "ring1", "ring2",
] as const;
export type EquipmentSlot = (typeof equipmentSlots)[number];

export interface InventoryItem {
  uid: string;
  itemId: string;
}

export type CharacterEquipment = Partial<Record<EquipmentSlot, InventoryItem>>;

export interface LootDrop {
  roomId: string;
  itemIds: string[];
}

export interface QuestProgress {
  questId: string;
  status: "active" | "completed";
}

export interface GameMessage {
  format?: "ansi";
  label?: string;
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
  gold: number;
  respawnAt: Record<string, number>;
  discoveredRoomIds: string[];
  searchedRoomIds: string[];
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
  inventory: InventoryItem[];
  inventorySeed: string;
  nextInventorySerial: number;
  equipment: CharacterEquipment;
  groundLoot: LootDrop[];
  quests: QuestProgress[];
  deathCount: number;
  lifeState?: "alive" | "dying" | "dead" | "permadead";
  conditionAt?: number;
  receivingAid?: boolean;
  pvpEnabled?: boolean;
  pvpConfirmation?: string;
  nextPvpAttackAt?: number;
  deathDrop?: { id: string; roomId: string; items: InventoryItem[]; gold: number };
  deathDropPublishedId?: string;
  claimedDropIds?: string[];
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
  lifeState: "alive" | "dying" | "dead" | "permadead";
  livesRemaining: number;
  pvpEnabled: boolean;
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
  "combat.player",
  "condition.player",
] as const;

export type RoomEventType = (typeof roomEventTypes)[number];

export interface RoomEventView {
  id: string;
  type: RoomEventType;
  tone: MessageTone;
  text: string;
  occurredAt: string;
}
