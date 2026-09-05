import { getItem } from "@/lib/game/items";
import type {
  CharacterAttributes,
  CharacterState,
  DisciplineId,
} from "@/lib/game/types";

export interface DisciplineDefinition {
  id: DisciplineId;
  name: string;
  identity: string;
  ability: string;
  attributes: CharacterAttributes;
  maxHealth: number;
  maxMana: number;
  starterItemId: string;
}

export function deriveMaxHealth(
  attributes: CharacterAttributes,
  level: number,
): number {
  return 34 + attributes.vitality * 6 + Math.max(0, level - 1) * 6;
}

export function deriveMaxMana(
  attributes: CharacterAttributes,
  level: number,
): number {
  return attributes.intellect >= 4
    ? 8 + attributes.intellect * 4 + Math.max(0, level - 1) * 4
    : 0;
}

const vanguardAttributes = { might: 5, agility: 2, intellect: 1, vitality: 5 };
const wayfinderAttributes = { might: 2, agility: 5, intellect: 2, vitality: 3 };
const arcanistAttributes = { might: 1, agility: 2, intellect: 5, vitality: 2 };

export const disciplines: Record<DisciplineId, DisciplineDefinition> = {
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    identity: "Endure the blow, then answer with iron.",
    ability: "GUARD reduces the next retaliation against you.",
    attributes: vanguardAttributes,
    maxHealth: deriveMaxHealth(vanguardAttributes, 1),
    maxMana: deriveMaxMana(vanguardAttributes, 1),
    starterItemId: "lantern-blade",
  },
  wayfinder: {
    id: "wayfinder",
    name: "Wayfinder",
    identity: "Read the path, choose the moment, never waste an arrow.",
    ability: "AIM empowers your next weapon attack.",
    attributes: wayfinderAttributes,
    maxHealth: deriveMaxHealth(wayfinderAttributes, 1),
    maxMana: deriveMaxMana(wayfinderAttributes, 1),
    starterItemId: "reed-bow",
  },
  arcanist: {
    id: "arcanist",
    name: "Arcanist",
    identity: "Carry a spark into places where daylight has failed.",
    ability: "CAST EMBER <target> spends mana for a powerful attack.",
    attributes: arcanistAttributes,
    maxHealth: deriveMaxHealth(arcanistAttributes, 1),
    maxMana: deriveMaxMana(arcanistAttributes, 1),
    starterItemId: "ash-staff",
  },
};

export function chooseDiscipline(
  currentState: CharacterState,
  disciplineId: DisciplineId,
): CharacterState {
  if (currentState.discipline) return currentState;

  const discipline = disciplines[disciplineId];
  const starter = getItem(discipline.starterItemId);
  if (!starter?.slot) {
    throw new Error(`Discipline starter item is not equippable: ${starter?.id}`);
  }

  const maxHealth = deriveMaxHealth(discipline.attributes, currentState.level);
  const maxMana = deriveMaxMana(discipline.attributes, currentState.level);

  return {
    ...currentState,
    discipline: disciplineId,
    attributes: { ...discipline.attributes },
    health: maxHealth,
    maxHealth,
    mana: maxMana,
    maxMana,
    inventory: currentState.inventory.includes(starter.id)
      ? [...currentState.inventory]
      : [...currentState.inventory, starter.id],
    equipment: {
      ...currentState.equipment,
      [starter.slot]: starter.id,
    },
  };
}
