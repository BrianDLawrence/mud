import { getItem, legacyItemIds } from "@/lib/game/items";
import { firstLightWorld } from "@/lib/game/world";
import type {
  ActiveCombat,
  CharacterAttributes,
  CharacterEquipment,
  CharacterState,
  DisciplineId,
  EquipmentSlot,
  InventoryItem,
  LootDrop,
  QuestProgress,
} from "@/lib/game/types";
import { disciplineIds, equipmentSlots } from "@/lib/game/types";

const noviceAttributes: CharacterAttributes = {
  might: 2,
  agility: 2,
  intellect: 2,
  vitality: 2,
};

export function createInitialCharacterState(inventorySeed = "local"): CharacterState {
  const cloak = { uid: `${inventorySeed}:1`, itemId: "traveler-cloak" };
  return {
    gold: 15,
    respawnAt: {},
    discoveredRoomIds: [firstLightWorld.entryRoomId],
    searchedRoomIds: [],
    roomId: firstLightWorld.entryRoomId,
    disciplineRevision: 0,
    attributes: { ...noviceAttributes },
    health: 50,
    maxHealth: 50,
    mana: 0,
    maxMana: 0,
    experience: 0,
    level: 1,
    inventorySeed,
    nextInventorySerial: 3,
    inventory: [cloak, { uid: `${inventorySeed}:2`, itemId: "copper-coins" }],
    equipment: { back: cloak },
    groundLoot: [],
    quests: [],
    deathCount: 0,
    claimedDropIds: [],
    lifeState: "alive",
    pvpEnabled: false,
    defeatedCreatureIds: [],
  };
}

function finiteNonnegative(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function validDiscipline(value: unknown): DisciplineId | undefined {
  return typeof value === "string" &&
    disciplineIds.includes(value as DisciplineId)
    ? (value as DisciplineId)
    : undefined;
}

export function normalizeCharacterState(input: CharacterState, ownerId?: string): CharacterState {
  const source = input as CharacterState & {
    inventory?: Array<string | InventoryItem>;
    equipment?: Record<string, string | InventoryItem>;
    deathDrop?: CharacterState["deathDrop"] & { itemIds?: string[] };
    attributes?: Partial<CharacterAttributes>;
    groundLoot?: LootDrop[];
    quests?: QuestProgress[];
    deathCount?: number;
    mana?: number;
    maxMana?: number;
    disciplineRevision?: number;
    combat?: Partial<ActiveCombat>;
  };
  const inventorySeed = source.inventorySeed || (ownerId ? `legacy:${ownerId}` : "local");
  const fallback = createInitialCharacterState(inventorySeed);
  const maxHealth = Math.max(1, finiteNonnegative(source.maxHealth, 50));
  const maxMana = finiteNonnegative(source.maxMana, 0);
  const rawInventory = Array.isArray(source.inventory) ? source.inventory : fallback.inventory;
  const largestExistingSerial = rawInventory.reduce<number>((highest, raw) => {
    if (typeof raw === "string") return highest;
    const match = new RegExp(`^${inventorySeed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+)$`).exec(raw.uid ?? "");
    return Math.max(highest, match ? Number(match[1]) : 0);
  }, 0);
  let nextInventorySerial = Math.max(rawInventory.length + 1, largestExistingSerial + 1,
    Math.floor(finiteNonnegative(source.nextInventorySerial, 1)));
  const inventory: InventoryItem[] = [];
  const seenUids = new Set<string>();
  function addEntry(itemId: string, preferredUid?: string): InventoryItem {
    const normalizedId = legacyItemIds[itemId] ?? itemId;
    let uid = preferredUid || `${inventorySeed}:${nextInventorySerial++}`;
    if (seenUids.has(uid)) uid = `${inventorySeed}:${nextInventorySerial++}`;
    seenUids.add(uid);
    const entry = { uid, itemId: normalizedId };
    inventory.push(entry);
    return entry;
  }
  for (const raw of rawInventory) {
    if (typeof raw === "string") addEntry(raw);
    else if (raw && typeof raw.itemId === "string") addEntry(raw.itemId, raw.uid);
  }
  const wasLegacyInventory = rawInventory.some((entry) => typeof entry === "string");
  if (wasLegacyInventory) {
    for (const entry of [...inventory]) {
      const tier = /^trail-armor-([1-5])$/.exec(entry.itemId)?.[1];
      if (tier) {
        addEntry(`trail-greaves-${tier}`);
        addEntry(`trail-boots-${tier}`);
      }
    }
  }
  const equipment: CharacterEquipment = {};
  const usedUids = new Set<string>();
  for (const [legacySlot, raw] of Object.entries(source.equipment ?? {})) {
    const itemId = typeof raw === "string" ? legacyItemIds[raw] ?? raw : raw?.itemId;
    if (!itemId) continue;
    const item = getItem(itemId);
    if (!item?.slot) continue;
    const entry = typeof raw === "string"
      ? inventory.find((candidate) => candidate.itemId === itemId && !usedUids.has(candidate.uid))
      : inventory.find((candidate) => candidate.uid === raw.uid && candidate.itemId === itemId);
    if (!entry) continue;
    usedUids.add(entry.uid);
    const slot: EquipmentSlot = equipmentSlots.includes(legacySlot as EquipmentSlot)
      ? legacySlot as EquipmentSlot
      : legacySlot === "weapon" ? "mainHand" : item.slot;
    for (const occupied of item.occupies ?? [slot]) equipment[occupied] = entry;
  }
  if (!source.equipment && inventory.some((entry) => entry.itemId === "traveler-cloak")) {
    equipment.back = inventory.find((entry) => entry.itemId === "traveler-cloak");
  }
  if (wasLegacyInventory) {
    const tier = /^trail-armor-([1-5])$/.exec(equipment.chest?.itemId ?? "")?.[1];
    if (tier) {
      equipment.legs ??= inventory.find((entry) => entry.itemId === `trail-greaves-${tier}`);
      equipment.feet ??= inventory.find((entry) => entry.itemId === `trail-boots-${tier}`);
    }
  }
  const discipline = validDiscipline(source.discipline);
  const combat = source.combat
    ? {
        creatureId: source.combat.creatureId || "",
        roomId: source.combat.roomId || source.roomId || fallback.roomId,
        health: Math.max(1, finiteNonnegative(source.combat.health, 1)),
        playerAttacking: source.combat.playerAttacking ?? true,
        nextPlayerAttackAt: finiteNonnegative(
          source.combat.nextPlayerAttackAt,
          0,
        ),
        nextCreatureAttackAt: finiteNonnegative(
          source.combat.nextCreatureAttackAt,
          0,
        ),
        sequence: Math.floor(finiteNonnegative(source.combat.sequence, 0)),
      }
    : undefined;

  return {
    gold: finiteNonnegative(source.gold, 15),
    respawnAt: { ...(source.respawnAt ?? {}) },
    discoveredRoomIds: [...(source.discoveredRoomIds ?? [source.roomId || fallback.roomId])],
    searchedRoomIds: [...(source.searchedRoomIds ?? [])],
    roomId: source.roomId || fallback.roomId,
    discipline,
    disciplineRevision: Math.floor(
      finiteNonnegative(source.disciplineRevision, discipline ? 1 : 0),
    ),
    attributes: {
      might: finiteNonnegative(source.attributes?.might, noviceAttributes.might),
      agility: finiteNonnegative(source.attributes?.agility, noviceAttributes.agility),
      intellect: finiteNonnegative(
        source.attributes?.intellect,
        noviceAttributes.intellect,
      ),
      vitality: finiteNonnegative(
        source.attributes?.vitality,
        noviceAttributes.vitality,
      ),
    },
    health: Math.min(maxHealth, finiteNumber(source.health, maxHealth)),
    maxHealth,
    mana: Math.min(maxMana, finiteNonnegative(source.mana, maxMana)),
    maxMana,
    experience: finiteNonnegative(source.experience, 0),
    level: Math.max(1, Math.floor(finiteNonnegative(source.level, 1))),
    inventory,
    inventorySeed,
    nextInventorySerial,
    equipment,
    groundLoot: Array.isArray(source.groundLoot)
      ? source.groundLoot.map((drop) => ({
          roomId: drop.roomId,
          itemIds: [...drop.itemIds],
        }))
      : [],
    quests: Array.isArray(source.quests)
      ? source.quests.map((quest) => ({ ...quest }))
      : [],
    ...(typeof source.offeredQuestId === "string" &&
      firstLightWorld.quests.some((quest) =>
        quest.id === source.offeredQuestId &&
        !(Array.isArray(source.quests) && source.quests.some((progress) => progress.questId === quest.id)) &&
        firstLightWorld.rooms.some((room) =>
          room.id === source.roomId && room.npcs.some((npc) => npc.id === quest.giverNpcId),
        ),
      ) ? { offeredQuestId: source.offeredQuestId } : {}),
    deathCount: Math.floor(finiteNonnegative(source.deathCount, 0)),
    lifeState: ["alive", "dying", "dead", "permadead"].includes(source.lifeState ?? "")
      ? source.lifeState
      : "alive",
    ...(source.conditionAt ? { conditionAt: finiteNonnegative(source.conditionAt, 0) } : {}),
    ...(source.receivingAid ? { receivingAid: true } : {}),
    pvpEnabled: source.pvpEnabled || false,
    ...(typeof source.pvpConfirmation === "string" ? { pvpConfirmation: source.pvpConfirmation } : {}),
    ...(source.nextPvpAttackAt ? { nextPvpAttackAt: finiteNonnegative(source.nextPvpAttackAt, 0) } : {}),
    ...(source.deathDrop ? { deathDrop: {
      id: source.deathDrop.id,
      roomId: source.deathDrop.roomId,
      items: Array.isArray(source.deathDrop.items)
        ? source.deathDrop.items.map((entry) => ({ ...entry }))
        : (source.deathDrop.itemIds ?? []).map((itemId, index) => ({
          uid: `${inventorySeed}:legacy-drop:${source.deathDrop!.id}:${index}`,
          itemId: legacyItemIds[itemId] ?? itemId,
        })),
      gold: source.deathDrop.gold,
    } } : {}),
    ...(source.deathDropPublishedId ? { deathDropPublishedId: source.deathDropPublishedId } : {}),
    claimedDropIds: Array.isArray(source.claimedDropIds) ? [...source.claimedDropIds] : [],
    defeatedCreatureIds: Array.isArray(source.defeatedCreatureIds)
      ? [...source.defeatedCreatureIds]
      : [],
    guarding: source.guarding || undefined,
    aiming: source.aiming || undefined,
    sneaking: source.sneaking || undefined,
    combat: combat?.creatureId ? combat : undefined,
  };
}
