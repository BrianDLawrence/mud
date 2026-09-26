import type {
  CharacterAttributes,
  ArmorWeight,
  CharacterEquipment,
  CharacterState,
  DisciplineId,
  EquipmentSlot,
  InventoryItem,
} from "@/lib/game/types";

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  slot?: EquipmentSlot;
  occupies?: EquipmentSlot[];
  powerKind?: "weapon" | "focus";
  price?: number;
  bonuses?: Partial<CharacterAttributes>;
  heal?: number;
  manaRestore?: number;
  power?: number;
  armor?: number;
  armorWeight?: ArmorWeight;
  discipline?: DisciplineId;
}

const itemDefinitions: ItemDefinition[] = [
  { id: "healing-draught", name: "healing draught", description: "USE healing draught: restores 40 HP.", price: 12, heal: 40 },
  { id: "mana-draught", name: "mana draught", description: "USE mana draught: restores 24 MP.", price: 12, manaRestore: 24 },
  ...[1, 2, 3, 4, 5].flatMap((tier): ItemDefinition[] => [
    { id: `trail-blade-${tier}`, name: `trail blade ${tier}`, description: `Tier ${tier} balanced steel. +${tier} Might.`, slot: "mainHand", powerKind: "weapon", power: 3 + tier * 2, bonuses: { might: tier }, price: tier * tier * 30 },
    { id: `trail-focus-${tier}`, name: `trail focus ${tier}`, description: `Tier ${tier} carved amber. +${tier} Intellect.`, slot: "offHand", powerKind: "focus", power: 3 + tier * 2, bonuses: { intellect: tier }, price: tier * tier * 30 },
    { id: `trail-armor-${tier}`, name: `trail armor ${tier}`, description: `Tier ${tier} supple leather chest armor.`, slot: "chest", armorWeight: "light", armor: 2 + tier, bonuses: tier > 1 ? { agility: tier - 1 } : {}, price: tier * tier * 25 },
    { id: `trail-greaves-${tier}`, name: `trail greaves ${tier}`, description: `Tier ${tier} reinforced leg armor.`, slot: "legs", armorWeight: "light", armor: tier, price: tier * tier * 16 },
    { id: `trail-boots-${tier}`, name: `trail boots ${tier}`, description: `Tier ${tier} sure-footed boots. +1 Agility.`, slot: "feet", armorWeight: "light", bonuses: { agility: 1 }, price: tier * tier * 16 },
  ]),
  { id: "trail-helm", name: "trail helm", description: "A light helm with a reinforced brow.", slot: "head", armorWeight: "light", armor: 1, price: 22 },
  { id: "trail-gloves", name: "trail gloves", description: "Gloves that keep a firm grip on wet steel. +1 Might.", slot: "hands", armorWeight: "light", bonuses: { might: 1 }, price: 25 },
  { id: "trail-belt", name: "trail belt", description: "A broad belt with a padded buckle.", slot: "belt", armorWeight: "light", armor: 1, price: 20 },
  { id: "trail-shield", name: "trail shield", description: "A small reinforced shield.", slot: "offHand", armorWeight: "medium", armor: 2, price: 35 },
  { id: "waystone-pendant", name: "waystone pendant", description: "A polished stone that sharpens thought. +1 Intellect.", slot: "neck", bonuses: { intellect: 1 }, price: 45 },
  { id: "copper-signet", name: "copper signet", description: "A weighty ring that steadies the hand. +1 Might.", slot: "ring1", bonuses: { might: 1 }, price: 55 },
  {
    id: "traveler-cloak",
    name: "worn traveler's cloak",
    description: "A rain-dark cloak patched more often than it has been washed.",
    slot: "back",
    armor: 1,
    armorWeight: "light",
  },
  {
    id: "lantern-plate",
    name: "lantern plate",
    description: "Heavy iron plates burnished around the edges like lamplight.",
    slot: "chest",
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
    slot: "mainHand", powerKind: "weapon",
    power: 3,
    discipline: "vanguard",
  },
  {
    id: "reed-bow",
    name: "reed bow",
    description: "A compact marsh bow strung with waxed black cord.",
    slot: "mainHand", powerKind: "weapon",
    power: 3,
    discipline: "wayfinder",
  },
  {
    id: "ash-staff",
    name: "ash staff",
    description: "Embers move beneath the grain of this blackened staff.",
    slot: "mainHand", occupies: ["mainHand", "offHand"], powerKind: "focus",
    power: 3,
    discipline: "arcanist",
  },
  {
    id: "sunward-mace",
    name: "sunward mace",
    description: "A heavy copper-headed mace engraved with a simple dawn mark.",
    slot: "mainHand", powerKind: "weapon",
    power: 3,
    discipline: "paladin",
  },
  {
    id: "sunward-mail",
    name: "sunward mail",
    description: "Heavy linked armor with a pale cloth mantle at the shoulders.",
    slot: "chest",
    armor: 3,
    armorWeight: "heavy",
    discipline: "paladin",
  },
  {
    id: "wardbreaker",
    name: "wardbreaker crossbow",
    description: "A compact crossbow fitted with cold-iron arms and a blunt silver sight.",
    slot: "mainHand", powerKind: "weapon",
    power: 3,
    discipline: "witchhunter",
  },
  {
    id: "hexhide-coat",
    name: "hexhide coat",
    description: "Medium leather armor stitched with broken runes that refuse enchantment.",
    slot: "chest",
    armor: 2,
    armorWeight: "medium",
    discipline: "witchhunter",
  },
  {
    id: "gutter-knife",
    name: "gutter knife",
    description: "A narrow, darkened blade balanced for a sudden close strike.",
    slot: "mainHand", powerKind: "weapon",
    power: 2,
    discipline: "rogue",
  },
  {
    id: "nightweave-vest",
    name: "nightweave vest",
    description: "Light layered cloth that makes scarcely a sound when it bends.",
    slot: "chest",
    armor: 1,
    armorWeight: "light",
    discipline: "rogue",
  },
  {
    id: "crawler-chitin",
    name: "crawler chitin",
    description: "A curved plate of mud-black shell, tough enough to wear.",
    slot: "chest",
    armor: 2,
    armorWeight: "light",
  },
  {
    id: "pale-heart-charm",
    name: "pale-heart charm",
    description: "A cold wooden charm cut from the orchard's buried heart.",
    slot: "neck", powerKind: "focus",
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
  const entry = findCarriedEntry(state, target);
  return entry ? getItem(entry.itemId) : undefined;
}

export function findCarriedEntry(
  state: CharacterState,
  target: string,
): InventoryItem | undefined {
  const normalized = target.trim().toLocaleLowerCase();
  return state.inventory
    .filter((entry) => !isEquipped(state.equipment, entry))
    .find((entry) => {
      const item = getItem(entry.itemId);
      return item && (item.id.toLocaleLowerCase() === normalized ||
        item.name.toLocaleLowerCase() === normalized);
    }) ?? state.inventory.find((entry) => {
      const item = getItem(entry.itemId);
      return item && (item.id.toLocaleLowerCase() === normalized ||
        item.name.toLocaleLowerCase() === normalized);
    });
}

export function isEquipped(equipment: CharacterEquipment, entry: InventoryItem): boolean {
  return Object.values(equipment).some((equipped) => equipped?.uid === entry.uid);
}

export function uniqueEquipped(equipment: CharacterEquipment): InventoryItem[] {
  return [...new Map(Object.values(equipment)
    .filter((entry): entry is InventoryItem => Boolean(entry))
    .map((entry) => [entry.uid, entry])).values()];
}

export function grantItems(state: CharacterState, itemIds: string[]): CharacterState {
  let serial = state.nextInventorySerial;
  const entries = itemIds.map((itemId) => ({
    uid: `${state.inventorySeed}:${serial++}`,
    itemId,
  }));
  return { ...state, inventory: [...state.inventory, ...entries], nextInventorySerial: serial };
}

export function receiveItems(state: CharacterState, incoming: InventoryItem[]): CharacterState {
  const used = new Set(state.inventory.map((entry) => entry.uid));
  let serial = state.nextInventorySerial;
  const entries = incoming.map((entry) => {
    let uid = entry.uid;
    while (used.has(uid)) uid = `${state.inventorySeed}:${serial++}`;
    used.add(uid);
    return { uid, itemId: entry.itemId };
  });
  return { ...state, inventory: [...state.inventory, ...entries], nextInventorySerial: serial };
}

export function equipmentArmor(equipment: CharacterEquipment): number {
  return uniqueEquipped(equipment).reduce(
    (total, entry) => total + (getItem(entry.itemId)?.armor ?? 0),
    0,
  );
}

export function equipmentPower(
  equipment: CharacterEquipment,
  kind: "weapon" | "focus",
): number {
  return Math.max(0, ...uniqueEquipped(equipment).map((entry) => {
    const item = getItem(entry.itemId);
    return item?.powerKind === kind ? item.power ?? 0 : 0;
  }));
}

export function effectiveAttributes(state: CharacterState): CharacterAttributes {
  const result = { ...state.attributes };
  for (const entry of uniqueEquipped(state.equipment)) {
    for (const [key, value] of Object.entries(getItem(entry.itemId)?.bonuses ?? {})) {
      result[key as keyof CharacterAttributes] += value;
    }
  }
  return result;
}
