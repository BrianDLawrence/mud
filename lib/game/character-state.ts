import { legacyItemIds } from "@/lib/game/items";
import { firstLightWorld } from "@/lib/game/world";
import type {
  ActiveCombat,
  CharacterAttributes,
  CharacterEquipment,
  CharacterState,
  DisciplineId,
  LootDrop,
  QuestProgress,
} from "@/lib/game/types";
import { disciplineIds } from "@/lib/game/types";

const noviceAttributes: CharacterAttributes = {
  might: 2,
  agility: 2,
  intellect: 2,
  vitality: 2,
};

export function createInitialCharacterState(): CharacterState {
  return {
    roomId: firstLightWorld.entryRoomId,
    disciplineRevision: 0,
    attributes: { ...noviceAttributes },
    health: 50,
    maxHealth: 50,
    mana: 0,
    maxMana: 0,
    experience: 0,
    level: 1,
    inventory: ["traveler-cloak", "copper-coins"],
    equipment: { armor: "traveler-cloak" },
    groundLoot: [],
    quests: [],
    deathCount: 0,
    defeatedCreatureIds: [],
  };
}

function finiteNonnegative(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function validDiscipline(value: unknown): DisciplineId | undefined {
  return typeof value === "string" &&
    disciplineIds.includes(value as DisciplineId)
    ? (value as DisciplineId)
    : undefined;
}

export function normalizeCharacterState(input: CharacterState): CharacterState {
  const source = input as CharacterState & {
    attributes?: Partial<CharacterAttributes>;
    equipment?: CharacterEquipment;
    groundLoot?: LootDrop[];
    quests?: QuestProgress[];
    deathCount?: number;
    mana?: number;
    maxMana?: number;
    disciplineRevision?: number;
    combat?: Partial<ActiveCombat>;
  };
  const fallback = createInitialCharacterState();
  const maxHealth = Math.max(1, finiteNonnegative(source.maxHealth, 50));
  const maxMana = finiteNonnegative(source.maxMana, 0);
  const inventory = Array.isArray(source.inventory)
    ? source.inventory.map((itemId) => legacyItemIds[itemId] ?? itemId)
    : [...fallback.inventory];
  const equipment = source.equipment
    ? { ...source.equipment }
    : inventory.includes("traveler-cloak")
      ? { armor: "traveler-cloak" }
      : {};
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
    health: Math.min(maxHealth, finiteNonnegative(source.health, maxHealth)),
    maxHealth,
    mana: Math.min(maxMana, finiteNonnegative(source.mana, maxMana)),
    maxMana,
    experience: finiteNonnegative(source.experience, 0),
    level: Math.max(1, Math.floor(finiteNonnegative(source.level, 1))),
    inventory,
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
    deathCount: Math.floor(finiteNonnegative(source.deathCount, 0)),
    defeatedCreatureIds: Array.isArray(source.defeatedCreatureIds)
      ? [...source.defeatedCreatureIds]
      : [],
    guarding: source.guarding || undefined,
    aiming: source.aiming || undefined,
    sneaking: source.sneaking || undefined,
    combat: combat?.creatureId ? combat : undefined,
  };
}
