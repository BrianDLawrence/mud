import type {
  CharacterEquipment,
  CharacterState,
  DisciplineId,
  EquipmentSlot,
} from "@/lib/game/types";

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  slot?: EquipmentSlot;
  power?: number;
  armor?: number;
  discipline?: DisciplineId;
}

const itemDefinitions = [
  {
    id: "traveler-cloak",
    name: "worn traveler's cloak",
    description: "A rain-dark cloak patched more often than it has been washed.",
    slot: "armor",
    armor: 1,
  },
  {
    id: "copper-coins",
    name: "three copper coins",
    description: "Enough for a hot meal, if the innkeeper is feeling generous.",
  },
  {
    id: "lantern-blade",
    name: "lantern blade",
    description: "A broad iron sword with a warm copper wire around its grip.",
    slot: "weapon",
    power: 3,
    discipline: "vanguard",
  },
  {
    id: "reed-bow",
    name: "reed bow",
    description: "A compact marsh bow strung with waxed black cord.",
    slot: "weapon",
    power: 3,
    discipline: "wayfinder",
  },
  {
    id: "ash-staff",
    name: "ash staff",
    description: "Embers move beneath the grain of this blackened staff.",
    slot: "focus",
    power: 3,
    discipline: "arcanist",
  },
  {
    id: "crawler-chitin",
    name: "crawler chitin",
    description: "A curved plate of mud-black shell, tough enough to wear.",
    slot: "armor",
    armor: 2,
  },
  {
    id: "pale-heart-charm",
    name: "pale-heart charm",
    description: "A cold wooden charm cut from the orchard's buried heart.",
    slot: "focus",
    power: 2,
  },
] satisfies ItemDefinition[];

export const items = new Map(
  itemDefinitions.map((item) => [item.id, item] as const),
);

export const legacyItemIds: Record<string, string> = {
  "worn traveler's cloak": "traveler-cloak",
  "three copper coins": "copper-coins",
};

export function getItem(itemId: string): ItemDefinition | undefined {
  return items.get(itemId);
}

export function itemName(itemId: string): string {
  return getItem(itemId)?.name ?? itemId;
}

export function findCarriedItem(
  state: CharacterState,
  target: string,
): ItemDefinition | undefined {
  const normalized = target.trim().toLocaleLowerCase();
  return state.inventory
    .map((itemId) => getItem(itemId))
    .find(
      (item) =>
        item &&
        (item.id.toLocaleLowerCase() === normalized ||
          item.name.toLocaleLowerCase() === normalized),
    );
}

export function equipmentArmor(equipment: CharacterEquipment): number {
  return Object.values(equipment).reduce(
    (total, itemId) => total + (itemId ? getItem(itemId)?.armor ?? 0 : 0),
    0,
  );
}

export function equipmentPower(
  equipment: CharacterEquipment,
  slot: "weapon" | "focus",
): number {
  const itemId = equipment[slot];
  return itemId ? getItem(itemId)?.power ?? 0 : 0;
}
