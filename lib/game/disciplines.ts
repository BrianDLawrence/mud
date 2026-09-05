import { getItem } from "@/lib/game/items";
import type {
  ArmorWeight,
  CharacterAttributes,
  CharacterState,
  DisciplineId,
} from "@/lib/game/types";

export const CURRENT_DISCIPLINE_REVISION = 2;

export interface DisciplineDefinition {
  id: DisciplineId;
  name: string;
  identity: string;
  ability: string;
  attributes: CharacterAttributes;
  maxHealth: number;
  maxMana: number;
  armorTraining: ArmorWeight;
  magicResistance: number;
  healingEffectiveness: number;
  starterItemIds: string[];
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
const paladinAttributes = { might: 4, agility: 2, intellect: 4, vitality: 5 };
const witchHunterAttributes = { might: 4, agility: 4, intellect: 1, vitality: 4 };
const rogueAttributes = { might: 3, agility: 7, intellect: 2, vitality: 2 };

export const disciplines: Record<DisciplineId, DisciplineDefinition> = {
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    identity: "Endure the blow, then answer with iron.",
    ability: "GUARD reduces the next retaliation against you.",
    attributes: vanguardAttributes,
    maxHealth: deriveMaxHealth(vanguardAttributes, 1),
    maxMana: deriveMaxMana(vanguardAttributes, 1),
    armorTraining: "heavy",
    magicResistance: 0,
    healingEffectiveness: 1,
    starterItemIds: ["lantern-blade", "lantern-plate"],
  },
  wayfinder: {
    id: "wayfinder",
    name: "Wayfinder",
    identity: "Read the path, choose the moment, never waste an arrow.",
    ability: "AIM empowers your next attack volley.",
    attributes: wayfinderAttributes,
    maxHealth: deriveMaxHealth(wayfinderAttributes, 1),
    maxMana: deriveMaxMana(wayfinderAttributes, 1),
    armorTraining: "medium",
    magicResistance: 0,
    healingEffectiveness: 1,
    starterItemIds: ["reed-bow"],
  },
  arcanist: {
    id: "arcanist",
    name: "Arcanist",
    identity: "Carry a spark into places where daylight has failed.",
    ability: "CAST EMBER <target> spends mana for a powerful attack.",
    attributes: arcanistAttributes,
    maxHealth: deriveMaxHealth(arcanistAttributes, 1),
    maxMana: deriveMaxMana(arcanistAttributes, 1),
    armorTraining: "light",
    magicResistance: 0,
    healingEffectiveness: 1,
    starterItemIds: ["ash-staff"],
  },
  paladin: {
    id: "paladin",
    name: "Paladin",
    identity: "Stand in heavy armor and carry a small light into the dark.",
    ability: "SMITE <target> spends mana; PRAY restores health.",
    attributes: paladinAttributes,
    maxHealth: deriveMaxHealth(paladinAttributes, 1),
    maxMana: deriveMaxMana(paladinAttributes, 1),
    armorTraining: "heavy",
    magicResistance: 0.2,
    healingEffectiveness: 1,
    starterItemIds: ["sunward-mace", "sunward-mail"],
  },
  witchhunter: {
    id: "witchhunter",
    name: "Witch Hunter",
    identity: "Refuse every spell, whether curse or blessing.",
    ability: "RESISTANCE shows your passive magic and healing resistance.",
    attributes: witchHunterAttributes,
    maxHealth: deriveMaxHealth(witchHunterAttributes, 1),
    maxMana: 0,
    armorTraining: "medium",
    magicResistance: 0.6,
    healingEffectiveness: 0.5,
    starterItemIds: ["wardbreaker", "hexhide-coat"],
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    identity: "Move unseen, strike first, and never be where the blow lands.",
    ability: "SNEAK, then BACKSTAB <target> for a guaranteed critical opening.",
    attributes: rogueAttributes,
    maxHealth: deriveMaxHealth(rogueAttributes, 1),
    maxMana: 0,
    armorTraining: "light",
    magicResistance: 0,
    healingEffectiveness: 1,
    starterItemIds: ["gutter-knife", "nightweave-vest"],
  },
};

export function chooseDiscipline(
  currentState: CharacterState,
  disciplineId: DisciplineId,
): CharacterState {
  if (
    currentState.discipline &&
    currentState.disciplineRevision >= CURRENT_DISCIPLINE_REVISION
  ) {
    return currentState;
  }

  const discipline = disciplines[disciplineId];
  const starters = discipline.starterItemIds.map((itemId) => getItem(itemId));
  if (starters.some((starter) => !starter?.slot)) {
    throw new Error(`Discipline has a missing or unequippable starter item.`);
  }

  const maxHealth = deriveMaxHealth(discipline.attributes, currentState.level);
  const maxMana = deriveMaxMana(discipline.attributes, currentState.level);

  return {
    ...currentState,
    discipline: disciplineId,
    disciplineRevision: CURRENT_DISCIPLINE_REVISION,
    attributes: { ...discipline.attributes },
    health: maxHealth,
    maxHealth,
    mana: maxMana,
    maxMana,
    inventory: [
      ...currentState.inventory,
      ...starters
        .map((starter) => starter!.id)
        .filter((itemId) => !currentState.inventory.includes(itemId)),
    ],
    equipment: starters.reduce(
      (equipment, starter) => ({
        ...equipment,
        [starter!.slot!]: starter!.id,
      }),
      { ...currentState.equipment },
    ),
    guarding: undefined,
    aiming: undefined,
    sneaking: undefined,
    combat: undefined,
  };
}
