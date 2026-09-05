import type {
  ArmorWeight,
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
  armorWeight?: ArmorWeight;
  discipline?: DisciplineId;
}

const itemDefinitions = [
  {
    id: "traveler-cloak",
    name: "worn traveler's cloak",
    description: "A rain-dark cloak patched more often than it has been washed.",
    slot: "armor",
    armor: 1,
    armorWeight: "light",
  },
  {
    id: "lantern-plate",
    name: "lantern plate",
    description: "Heavy iron plates burnished around the edges like lamplight.",
    slot: "armor",
    armor: 3,
    armorWeight: "heavy",
    discipline: "vanguard",
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
    id: "sunward-mace",
    name: "sunward mace",
    description: "A heavy copper-headed mace engraved with a simple dawn mark.",
    slot: "weapon",
    power: 3,
    discipline: "paladin",
  },
  {
    id: "sunward-mail",
    name: "sunward mail",
    description: "Heavy linked armor with a pale cloth mantle at the shoulders.",
    slot: "armor",
    armor: 3,
    armorWeight: "heavy",
    discipline: "paladin",
  },
  {
    id: "wardbreaker",
    name: "wardbreaker crossbow",
    description: "A compact crossbow fitted with cold-iron arms and a blunt silver sight.",
    slot: "weapon",
    power: 3,
    discipline: "witchhunter",
  },
  {
    id: "hexhide-coat",
    name: "hexhide coat",
    description: "Medium leather armor stitched with broken runes that refuse enchantment.",
    slot: "armor",
    armor: 2,
    armorWeight: "medium",
    discipline: "witchhunter",
  },
  {
    id: "gutter-knife",
    name: "gutter knife",
    description: "A narrow, darkened blade balanced for a sudden close strike.",
    slot: "weapon",
    power: 2,
    discipline: "rogue",
  },
  {
    id: "nightweave-vest",
    name: "nightweave vest",
    description: "Light layered cloth that makes scarcely a sound when it bends.",
    slot: "armor",
    armor: 1,
    armorWeight: "light",
    discipline: "rogue",
  },
  {
    id: "crawler-chitin",
    name: "crawler chitin",
    description: "A curved plate of mud-black shell, tough enough to wear.",
    slot: "armor",
    armor: 2,
    armorWeight: "light",
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
