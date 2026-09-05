import { normalizeCharacterState } from "@/lib/game/character-state";
import { disciplines } from "@/lib/game/disciplines";
import {
  equipmentArmor,
  equipmentPower,
  findCarriedItem,
  itemName,
} from "@/lib/game/items";
import type { CharacterState, CommandResult, GameMessage } from "@/lib/game/types";
import { firstLightWorld, getRoom } from "@/lib/game/world";
import type { Creature, Npc, Quest, Room } from "@/lib/game/world-schema";

export { createInitialCharacterState } from "@/lib/game/character-state";

const directionAliases: Record<string, string> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  u: "up",
  d: "down",
};

const helpText = [
  "look",
  "examine <thing>",
  "north/south/east/west/up/down",
  "attack <creature>",
  "stop",
  "guard / aim / cast ember <creature>",
  "smite <creature> / pray",
  "sneak / backstab <creature>",
  "resistance",
  "loot",
  "inventory",
  "equipment",
  "equip <item>",
  "talk <person>",
  "accept <quest>",
  "quests",
  "abilities",
  "rest",
  "stats",
  "say <message>",
  "emote <action>",
  "who",
  "signout",
  "help",
].join(" · ");

function message(tone: GameMessage["tone"], text: string): GameMessage {
  return { tone, text };
}

function normalizeTarget(target: string): string {
  return target.trim().toLocaleLowerCase();
}

function matchesTarget(
  target: string,
  candidate: { name: string; aliases: string[] },
): boolean {
  const normalized = normalizeTarget(target);
  return (
    candidate.name.toLocaleLowerCase() === normalized ||
    candidate.aliases.some((alias) => alias.toLocaleLowerCase() === normalized)
  );
}

function matchesQuest(target: string, quest: Quest): boolean {
  const normalized = normalizeTarget(target);
  return (
    quest.id === normalized ||
    quest.title.toLocaleLowerCase() === normalized ||
    quest.aliases.some((alias) => alias.toLocaleLowerCase() === normalized)
  );
}

function visibleCreatures(room: Room, state: CharacterState): Creature[] {
  return room.creatures.filter(
    (creature) => !state.defeatedCreatureIds.includes(creature.id),
  );
}

function roomLoot(state: CharacterState): string[] {
  return state.groundLoot
    .filter((drop) => drop.roomId === state.roomId)
    .flatMap((drop) => drop.itemIds);
}

function describeRoom(state: CharacterState): GameMessage[] {
  const room = getRoom(state.roomId);
  const exits = Object.keys(room.exits);
  const creatures = visibleCreatures(room, state);
  const loot = roomLoot(state);

  return [
    message("location", room.name),
    message("narrative", room.description),
    ...room.npcs.map((npc) => message("speech", `${npc.name} is here.`)),
    ...creatures.flatMap((creature) => [
      message("combat", `${creature.name} is here.`),
      message("narrative", creature.description),
    ]),
    ...(loot.length > 0
      ? [
          message(
            "experience",
            `On the ground: ${loot.map(itemName).join(", ")}. Type LOOT to take it.`,
          ),
        ]
      : []),
    message(
      "exits",
      `Obvious exits: ${exits.length > 0 ? exits.join(", ") : "none"}`,
    ),
  ];
}

function move(state: CharacterState, requestedDirection: string): CommandResult {
  const direction = directionAliases[requestedDirection] ?? requestedDirection;
  const room = getRoom(state.roomId);
  const destination = room.exits[direction as keyof typeof room.exits];

  if (!destination) {
    return {
      state,
      messages: [message("error", `You cannot go ${direction} from here.`)],
    };
  }

  const fled = Boolean(state.combat);
  const nextState = {
    ...state,
    roomId: destination,
    combat: undefined,
    guarding: undefined,
    aiming: undefined,
    sneaking: fled ? undefined : state.sneaking,
  };
  return {
    state: nextState,
    messages: [
      ...(fled ? [message("combat", "You break away from the fight.")] : []),
      ...describeRoom(nextState),
    ],
  };
}

function levelForExperience(experience: number): number {
  return Math.min(firstLightWorld.levelRange.max, Math.floor(experience / 100) + 1);
}

function awardExperience(
  state: CharacterState,
  amount: number,
): { state: CharacterState; messages: GameMessage[] } {
  const experience = state.experience + amount;
  const level = levelForExperience(experience);
  const levelsGained = Math.max(0, level - state.level);

  if (levelsGained === 0) {
    return {
      state: { ...state, experience },
      messages: [message("experience", `You gain ${amount} experience.`)],
    };
  }

  const maxHealth = state.maxHealth + levelsGained * 6;
  const maxMana = state.maxMana + (state.maxMana > 0 ? levelsGained * 4 : 0);
  return {
    state: {
      ...state,
      experience,
      level,
      maxHealth,
      health: maxHealth,
      maxMana,
      mana: maxMana,
    },
    messages: [
      message("experience", `You gain ${amount} experience.`),
      message(
        "experience",
        `LEVEL ${level}. New strength floods through you; your health${maxMana > 0 ? " and mana are" : " is"} restored.`,
      ),
    ],
  };
}

function markQuestObjectives(state: CharacterState, creatureId: string): GameMessage[] {
  return firstLightWorld.quests
    .filter(
      (quest) =>
        quest.objective.creatureId === creatureId &&
        state.quests.some(
          (progress) =>
            progress.questId === quest.id && progress.status === "active",
        ),
    )
    .map((quest) =>
      message(
        "experience",
        `QUEST UPDATED — ${quest.title}: return to ${
          firstLightWorld.rooms
            .flatMap((room) => room.npcs)
            .find((npc) => npc.id === quest.giverNpcId)?.name ?? "the quest giver"
        }.`,
      ),
    );
}

function defeatCreature(
  state: CharacterState,
  creature: Creature,
): CommandResult {
  const defeatedState: CharacterState = {
    ...state,
    combat: undefined,
    guarding: undefined,
    aiming: undefined,
    sneaking: undefined,
    defeatedCreatureIds: [...state.defeatedCreatureIds, creature.id],
    groundLoot:
      creature.loot.length > 0
        ? [
            ...state.groundLoot,
            { roomId: state.roomId, itemIds: [...creature.loot] },
          ]
        : state.groundLoot,
  };
  const progress = awardExperience(defeatedState, creature.experience);

  return {
    state: progress.state,
    messages: [
      message("combat", `${creature.name} falls still.`),
      ...progress.messages,
      ...(creature.loot.length > 0
        ? [
            message(
              "experience",
              `${creature.name} leaves ${creature.loot.map(itemName).join(", ")}.`,
            ),
          ]
        : []),
      ...markQuestObjectives(progress.state, creature.id),
    ],
  };
}

const MAX_COMBAT_EVENTS_PER_ADVANCE = 12;

export function attacksPerVolley(agility: number): number {
  if (agility >= 7) return 3;
  if (agility >= 4) return 2;
  return 1;
}

export function playerAttackIntervalMs(agility: number): number {
  return Math.max(1400, 3300 - agility * 250);
}

export function criticalChance(agility: number): number {
  return Math.min(40, 5 + agility * 3);
}

export function magicHealingReceived(
  state: CharacterState,
  amount: number,
): number {
  const effectiveness = state.discipline
    ? disciplines[state.discipline].healingEffectiveness
    : 1;
  return Math.max(0, Math.floor(amount * effectiveness));
}

function isCriticalHit(
  state: CharacterState,
  creatureHealth: number,
  sequence: number,
  offensiveStat = state.attributes.agility,
): boolean {
  const roll =
    ((sequence * 41 +
      offensiveStat * 13 +
      creatureHealth * 7 +
      state.experience * 3 +
      state.level * 17) %
      100) +
    1;
  return roll <= criticalChance(offensiveStat);
}

function startCombat(
  state: CharacterState,
  creature: Creature,
  nowMs: number,
): CharacterState {
  const existing =
    state.combat?.creatureId === creature.id &&
    state.combat.roomId === state.roomId
      ? state.combat
      : undefined;

  return {
    ...state,
    sneaking: undefined,
    combat: {
      creatureId: creature.id,
      roomId: state.roomId,
      health: existing?.health ?? creature.health,
      playerAttacking: true,
      nextPlayerAttackAt: nowMs,
      nextCreatureAttackAt:
        existing && existing.nextCreatureAttackAt > 0
          ? existing.nextCreatureAttackAt
          : nowMs + creature.attackIntervalMs,
      sequence: existing?.sequence ?? 0,
    },
  };
}

function damageCreature(
  state: CharacterState,
  creature: Creature,
  damage: number,
  text: string,
): CommandResult {
  if (!state.combat) return { state, messages: [] };

  const remainingHealth = Math.max(0, state.combat.health - damage);
  const nextState: CharacterState = {
    ...state,
    combat: { ...state.combat, health: remainingHealth },
  };
  const strike = message("combat", `${text} for ${damage} damage.`);
  if (remainingHealth > 0) {
    return { state: nextState, messages: [strike] };
  }

  const defeated = defeatCreature(nextState, creature);
  return { state: defeated.state, messages: [strike, ...defeated.messages] };
}

function playerVolley(
  state: CharacterState,
  creature: Creature,
  attackAt: number,
): CommandResult {
  if (!state.combat) return { state, messages: [] };

  let workingState = state;
  const messages: GameMessage[] = [];
  const hits = attacksPerVolley(state.attributes.agility);
  const aimedBonus = state.aiming ? 3 : 0;
  const baseDamage =
    3 +
    Math.floor(state.attributes.might / 2) +
    equipmentPower(state.equipment, "weapon") +
    aimedBonus;

  for (let hit = 1; hit <= hits && workingState.combat; hit += 1) {
    const sequence = workingState.combat.sequence;
    const critical = isCriticalHit(
      workingState,
      workingState.combat.health,
      sequence,
    );
    workingState = {
      ...workingState,
      combat: { ...workingState.combat, sequence: sequence + 1 },
    };
    const result = damageCreature(
      workingState,
      creature,
      baseDamage * (critical ? 2 : 1),
      `${critical ? "CRITICAL! " : ""}${
        hits > 1 ? `Hit ${hit}/${hits}: ` : ""
      }You strike ${creature.name}`,
    );
    workingState = result.state;
    messages.push(...result.messages);
  }

  if (workingState.combat) {
    workingState = {
      ...workingState,
      aiming: undefined,
      combat: {
        ...workingState.combat,
        nextPlayerAttackAt:
          attackAt + playerAttackIntervalMs(workingState.attributes.agility),
      },
    };
  }

  return { state: workingState, messages };
}

function creatureAttack(
  state: CharacterState,
  creature: Creature,
  attackAt: number,
): CommandResult {
  if (!state.combat) return { state, messages: [] };

  const discipline = state.discipline ? disciplines[state.discipline] : undefined;
  const guardReduction = state.guarding ? 4 : 0;
  const resistedDamage =
    creature.damageType === "magic"
      ? Math.ceil(creature.damage * (1 - (discipline?.magicResistance ?? 0)))
      : creature.damage - equipmentArmor(state.equipment);
  const minimumDamage = creature.damage > 0 ? 1 : 0;
  const damage = Math.max(minimumDamage, resistedDamage - guardReduction);
  const health = Math.max(0, state.health - damage);
  const combatState: CharacterState = {
    ...state,
    health,
    guarding: undefined,
    combat: {
      ...state.combat,
      nextCreatureAttackAt: attackAt + creature.attackIntervalMs,
    },
  };
  const resistanceNote =
    creature.damageType === "magic" && (discipline?.magicResistance ?? 0) > 0
      ? ` Your wards resist ${Math.round(discipline!.magicResistance * 100)}%.`
      : "";
  const strike = message(
    "combat",
    `${creature.name} ${creature.damageType === "magic" ? "lashes you with magic" : "strikes you"} for ${damage} damage.${resistanceNote}`,
  );

  if (health > 0) {
    return {
      state: combatState,
      messages: [
        strike,
        message("status", `You have ${health}/${state.maxHealth} health.`),
      ],
    };
  }

  const recoveryHealth = Math.ceil(state.maxHealth / 2);
  const recoveryMana = Math.ceil(state.maxMana / 2);
  return {
    state: {
      ...combatState,
      roomId: firstLightWorld.entryRoomId,
      health: recoveryHealth,
      mana: recoveryMana,
      deathCount: state.deathCount + 1,
      combat: undefined,
      aiming: undefined,
      sneaking: undefined,
    },
    messages: [
      strike,
      message("combat", "Darkness closes over you."),
      message(
        "location",
        "You wake beside the Copper Lantern, bruised but alive.",
      ),
      message(
        "status",
        `Health restored to ${recoveryHealth}/${state.maxHealth}. No experience was lost.`,
      ),
    ],
  };
}

export function advanceCombat(
  currentState: CharacterState,
  nowMs = Date.now(),
): CommandResult {
  let state = normalizeCharacterState(currentState);
  if (!state.combat || state.combat.roomId !== state.roomId) {
    return { state, messages: [] };
  }

  const creature = getRoom(state.roomId).creatures.find(
    (candidate) => candidate.id === state.combat?.creatureId,
  );
  if (!creature || state.defeatedCreatureIds.includes(creature.id)) {
    return { state: { ...state, combat: undefined }, messages: [] };
  }

  state = {
    ...state,
    combat: {
      ...state.combat,
      nextPlayerAttackAt:
        state.combat.playerAttacking && state.combat.nextPlayerAttackAt <= 0
          ? nowMs
          : state.combat.nextPlayerAttackAt,
      nextCreatureAttackAt:
        state.combat.nextCreatureAttackAt <= 0
          ? nowMs + creature.attackIntervalMs
          : state.combat.nextCreatureAttackAt,
    },
  };

  const messages: GameMessage[] = [];
  let events = 0;
  while (state.combat && events < MAX_COMBAT_EVENTS_PER_ADVANCE) {
    const playerAt = state.combat.playerAttacking
      ? state.combat.nextPlayerAttackAt
      : Number.POSITIVE_INFINITY;
    const creatureAt = state.combat.nextCreatureAttackAt;
    const nextEventAt = Math.min(playerAt, creatureAt);
    if (nextEventAt > nowMs) break;

    const result =
      playerAt <= creatureAt
        ? playerVolley(state, creature, playerAt)
        : creatureAttack(state, creature, creatureAt);
    state = result.state;
    messages.push(...result.messages);
    events += 1;
  }

  if (state.combat && events === MAX_COMBAT_EVENTS_PER_ADVANCE) {
    state = {
      ...state,
      combat: {
        ...state.combat,
        nextPlayerAttackAt:
          state.combat.playerAttacking && state.combat.nextPlayerAttackAt <= nowMs
            ? nowMs + playerAttackIntervalMs(state.attributes.agility)
            : state.combat.nextPlayerAttackAt,
        nextCreatureAttackAt:
          state.combat.nextCreatureAttackAt <= nowMs
            ? nowMs + creature.attackIntervalMs
            : state.combat.nextCreatureAttackAt,
      },
    };
  }

  return { state, messages };
}

function findVisibleCreature(
  state: CharacterState,
  target: string,
): Creature | undefined {
  return visibleCreatures(getRoom(state.roomId), state).find((candidate) =>
    matchesTarget(target, candidate),
  );
}

function attack(
  state: CharacterState,
  target: string,
  nowMs: number,
): CommandResult {
  const creature = findVisibleCreature(state, target);
  if (!creature) {
    return {
      state,
      messages: [message("error", `You see no "${target || "target"}" here.`)],
    };
  }

  if (state.combat && state.combat.creatureId !== creature.id) {
    return {
      state,
      messages: [message("error", "You are already engaged with another creature.")],
    };
  }
  if (state.combat?.playerAttacking) {
    return {
      state,
      messages: [message("status", `You are already attacking ${creature.name}.`)],
    };
  }

  const resuming = Boolean(state.combat);
  const engaged = startCombat(state, creature, nowMs);
  const result = advanceCombat(engaged, nowMs);
  return {
    state: result.state,
    messages: [
      message(
        "combat",
        `${resuming ? "You resume attacking" : "You engage"} ${creature.name}. Type STOP to halt your attacks.`,
      ),
      ...result.messages,
    ],
  };
}

function specialAttack(
  state: CharacterState,
  creature: Creature,
  nowMs: number,
  baseDamage: number,
  attackText: string,
  offensiveStat: number,
  forcedCritical = false,
): CommandResult {
  if (state.combat && state.combat.creatureId !== creature.id) {
    return {
      state,
      messages: [message("error", "You are already engaged with another creature.")],
    };
  }

  let engaged = startCombat(state, creature, nowMs);
  const sequence = engaged.combat!.sequence;
  const critical =
    forcedCritical ||
    isCriticalHit(engaged, engaged.combat!.health, sequence, offensiveStat);
  engaged = {
    ...engaged,
    combat: {
      ...engaged.combat!,
      sequence: sequence + 1,
      nextPlayerAttackAt:
        nowMs + playerAttackIntervalMs(engaged.attributes.agility),
    },
  };
  return damageCreature(
    engaged,
    creature,
    baseDamage * (critical ? 2 : 1),
    `${critical ? "CRITICAL! " : ""}${attackText} ${creature.name}`,
  );
}

function cast(
  state: CharacterState,
  argument: string,
  nowMs: number,
): CommandResult {
  const [spell = "", ...targetTokens] = argument.trim().split(/\s+/);
  const target = targetTokens.join(" ");
  if (spell.toLocaleLowerCase() !== "ember") {
    return {
      state,
      messages: [message("error", "Known spell: CAST EMBER <creature>.")],
    };
  }
  if (state.discipline !== "arcanist") {
    return {
      state,
      messages: [message("error", "Only an Arcanist can shape an ember.")],
    };
  }
  if (state.mana < 6) {
    return {
      state,
      messages: [message("error", "You need 6 mana to cast Ember.")],
    };
  }

  const creature = findVisibleCreature(state, target);
  if (!creature) {
    return {
      state,
      messages: [message("error", `You see no "${target || "target"}" here.`)],
    };
  }

  const castingState = { ...state, mana: state.mana - 6, aiming: undefined };
  const damage =
    5 +
    state.attributes.intellect +
    equipmentPower(state.equipment, "focus");
  const result = specialAttack(
    castingState,
    creature,
    nowMs,
    damage,
    "Your ember burns",
    state.attributes.intellect,
  );
  return {
    state: result.state,
    messages: [
      message("status", `You spend 6 mana. ${castingState.mana}/${state.maxMana} remain.`),
      ...result.messages,
    ],
  };
}

function smite(
  state: CharacterState,
  target: string,
  nowMs: number,
): CommandResult {
  if (state.discipline !== "paladin") {
    return {
      state,
      messages: [message("error", "Only a Paladin can call down a smite.")],
    };
  }
  if (state.mana < 4) {
    return { state, messages: [message("error", "You need 4 mana to Smite.")] };
  }
  const creature = findVisibleCreature(state, target);
  if (!creature) {
    return {
      state,
      messages: [message("error", `You see no "${target || "target"}" here.`)],
    };
  }

  const castingState = { ...state, mana: state.mana - 4, aiming: undefined };
  const result = specialAttack(
    castingState,
    creature,
    nowMs,
    5 + Math.floor(state.attributes.might / 2) + state.attributes.intellect,
    "Your smite sears",
    state.attributes.intellect,
  );
  return {
    state: result.state,
    messages: [
      message("status", `You spend 4 mana. ${castingState.mana}/${state.maxMana} remain.`),
      ...result.messages,
    ],
  };
}

function pray(state: CharacterState): CommandResult {
  if (state.discipline !== "paladin") {
    return {
      state,
      messages: [message("error", "Only a Paladin can use Prayer.")],
    };
  }
  if (state.mana < 6) {
    return { state, messages: [message("error", "You need 6 mana to Pray.")] };
  }
  if (state.health >= state.maxHealth) {
    return { state, messages: [message("status", "You are already at full health.")] };
  }

  const healing = magicHealingReceived(state, 14);
  const health = Math.min(state.maxHealth, state.health + healing);
  return {
    state: { ...state, health, mana: state.mana - 6 },
    messages: [
      message(
        "status",
        `A quiet light restores ${health - state.health} health. HP ${health}/${state.maxHealth} · MP ${state.mana - 6}/${state.maxMana}.`,
      ),
    ],
  };
}

function backstab(
  state: CharacterState,
  target: string,
  nowMs: number,
): CommandResult {
  if (state.discipline !== "rogue") {
    return {
      state,
      messages: [message("error", "Only a Rogue can Backstab.")],
    };
  }
  if (!state.sneaking) {
    return {
      state,
      messages: [message("error", "You must SNEAK before attempting a Backstab.")],
    };
  }
  const creature = findVisibleCreature(state, target);
  if (!creature) {
    return {
      state,
      messages: [message("error", `You see no "${target || "target"}" here.`)],
    };
  }

  return specialAttack(
    { ...state, sneaking: undefined },
    creature,
    nowMs,
    5 +
      Math.floor(state.attributes.might / 2) +
      equipmentPower(state.equipment, "weapon"),
    "You backstab",
    state.attributes.agility,
    true,
  );
}

function stopAttacking(state: CharacterState): CommandResult {
  if (!state.combat) {
    return { state, messages: [message("status", "You are not in combat.")] };
  }
  if (!state.combat.playerAttacking) {
    return {
      state,
      messages: [message("status", "You have already stopped attacking. Your enemy has not.")],
    };
  }

  const creature = getRoom(state.roomId).creatures.find(
    (candidate) => candidate.id === state.combat?.creatureId,
  );
  return {
    state: {
      ...state,
      aiming: undefined,
      combat: {
        ...state.combat,
        playerAttacking: false,
        nextPlayerAttackAt: 0,
      },
    },
    messages: [
      message(
        "combat",
        `You stop attacking${creature ? ` ${creature.name}` : ""}, but it continues to attack you. Move away to escape.`,
      ),
    ],
  };
}

function loot(state: CharacterState): CommandResult {
  const drops = state.groundLoot.filter((drop) => drop.roomId === state.roomId);
  const itemIds = drops.flatMap((drop) => drop.itemIds);
  if (itemIds.length === 0) {
    return { state, messages: [message("error", "There is nothing here to loot.")] };
  }

  return {
    state: {
      ...state,
      inventory: [...state.inventory, ...itemIds],
      groundLoot: state.groundLoot.filter((drop) => drop.roomId !== state.roomId),
    },
    messages: [
      message("experience", `You take ${itemIds.map(itemName).join(", ")}.`),
    ],
  };
}

function equip(state: CharacterState, target: string): CommandResult {
  const item = findCarriedItem(state, target);
  if (!item) {
    return {
      state,
      messages: [message("error", `You do not carry "${target || "that"}".`)],
    };
  }
  if (!item.slot) {
    return {
      state,
      messages: [message("error", `${item.name} cannot be equipped.`)],
    };
  }
  if (item.discipline && item.discipline !== state.discipline) {
    return {
      state,
      messages: [
        message("error", `${item.name} belongs to the ${disciplines[item.discipline].name}.`),
      ],
    };
  }
  if (item.armorWeight && state.discipline) {
    const armorRanks = { light: 1, medium: 2, heavy: 3 } as const;
    const training = disciplines[state.discipline].armorTraining;
    if (armorRanks[item.armorWeight] > armorRanks[training]) {
      return {
        state,
        messages: [
          message(
            "error",
            `${disciplines[state.discipline].name} training only supports ${training} armor.`,
          ),
        ],
      };
    }
  }

  return {
    state: {
      ...state,
      equipment: { ...state.equipment, [item.slot]: item.id },
    },
    messages: [message("status", `You equip ${item.name} as your ${item.slot}.`)],
  };
}

function findNpc(room: Room, target: string): Npc | undefined {
  return room.npcs.find((npc) => matchesTarget(target, npc));
}

function completeQuest(
  state: CharacterState,
  quest: Quest,
): CommandResult {
  const rewarded = awardExperience(
    {
      ...state,
      quests: state.quests.map((progress) =>
        progress.questId === quest.id
          ? { ...progress, status: "completed" as const }
          : progress,
      ),
      inventory: [...state.inventory, ...quest.reward.itemIds],
    },
    quest.reward.experience,
  );

  return {
    state: rewarded.state,
    messages: [
      message("speech", quest.readyDialogue),
      message("speech", quest.completionDialogue),
      message("experience", `QUEST COMPLETE — ${quest.title}.`),
      ...rewarded.messages,
      ...(quest.reward.itemIds.length > 0
        ? [
            message(
              "experience",
              `You receive ${quest.reward.itemIds.map(itemName).join(", ")}.`,
            ),
          ]
        : []),
    ],
  };
}

function talk(state: CharacterState, target: string): CommandResult {
  const npc = findNpc(getRoom(state.roomId), target);
  if (!npc) {
    return {
      state,
      messages: [message("error", `You see no "${target || "one"}" here to speak with.`)],
    };
  }

  const quest = firstLightWorld.quests.find(
    (candidate) => npc.questIds.includes(candidate.id),
  );
  if (!quest) {
    return { state, messages: [message("speech", npc.dialogue)] };
  }

  const progress = state.quests.find((entry) => entry.questId === quest.id);
  if (!progress) {
    return {
      state,
      messages: [
        message("speech", npc.dialogue),
        message("speech", quest.offeredDialogue),
        message("system", `QUEST OFFERED — ${quest.title}. Type ACCEPT ${quest.title}.`),
      ],
    };
  }
  if (progress.status === "completed") {
    return { state, messages: [message("speech", npc.dialogue)] };
  }
  if (state.defeatedCreatureIds.includes(quest.objective.creatureId)) {
    return completeQuest(state, quest);
  }
  return { state, messages: [message("speech", quest.activeDialogue)] };
}

function acceptQuest(state: CharacterState, target: string): CommandResult {
  const room = getRoom(state.roomId);
  const quest = firstLightWorld.quests.find((candidate) => matchesQuest(target, candidate));
  if (!quest || !room.npcs.some((npc) => npc.id === quest.giverNpcId)) {
    return {
      state,
      messages: [message("error", `No one here has offered "${target || "that quest"}".`)],
    };
  }

  const progress = state.quests.find((entry) => entry.questId === quest.id);
  if (progress) {
    return {
      state,
      messages: [
        message(
          "status",
          progress.status === "completed"
            ? `${quest.title} is already complete.`
            : `${quest.title} is already underway.`,
        ),
      ],
    };
  }

  return {
    state: {
      ...state,
      quests: [...state.quests, { questId: quest.id, status: "active" }],
    },
    messages: [
      message("experience", `QUEST ACCEPTED — ${quest.title}.`),
      message("narrative", quest.summary),
    ],
  };
}

function listQuests(state: CharacterState): CommandResult {
  if (state.quests.length === 0) {
    return {
      state,
      messages: [message("status", "You have no quests. Try speaking with Keeper Vale.")],
    };
  }

  return {
    state,
    messages: state.quests.map((progress) => {
      const quest = firstLightWorld.quests.find(
        (candidate) => candidate.id === progress.questId,
      );
      if (!quest) return message("status", `${progress.questId} — ${progress.status}.`);
      const ready = state.defeatedCreatureIds.includes(quest.objective.creatureId);
      return message(
        progress.status === "completed" ? "experience" : "status",
        `${quest.title} — ${
          progress.status === "completed"
            ? "complete"
            : ready
              ? "return to the quest giver"
              : quest.summary
        }`,
      );
    }),
  };
}

function abilityMessages(state: CharacterState): GameMessage[] {
  if (!state.discipline) return [message("error", "Choose a discipline first.")];
  const discipline = disciplines[state.discipline];
  return [
    message("status", `${discipline.name}: ${discipline.identity}`),
    message("system", discipline.ability),
  ];
}

function equipmentMessages(state: CharacterState): GameMessage[] {
  const slots = (["weapon", "armor", "focus"] as const)
    .map((slot) => `${slot}: ${state.equipment[slot] ? itemName(state.equipment[slot]!) : "none"}`)
    .join(" · ");
  return [
    message("status", slots),
    message(
      "system",
      `Armor ${equipmentArmor(state.equipment)} · Training ${
        state.discipline ? disciplines[state.discipline].armorTraining : "none"
      }.`,
    ),
  ];
}

interface ExecuteCommandOptions {
  nowMs?: number;
}

export function executeCommand(
  currentState: CharacterState,
  rawCommand: string,
  options: ExecuteCommandOptions = {},
): CommandResult {
  const state = normalizeCharacterState(currentState);
  const command = rawCommand.trim();

  if (!command) return { state, messages: [] };

  const [verbToken = "", ...argumentTokens] = command.split(/\s+/);
  const verb = verbToken.toLocaleLowerCase();
  const argument = argumentTokens.join(" ");
  const nowMs = options.nowMs ?? Date.now();

  if (!state.discipline && !["help", "?"].includes(verb)) {
    return {
      state,
      messages: [message("error", "Choose a discipline before entering the realm.")],
    };
  }

  if (
    [
      "n",
      "s",
      "e",
      "w",
      "u",
      "d",
      "north",
      "south",
      "east",
      "west",
      "up",
      "down",
    ].includes(verb)
  ) {
    return move(state, verb);
  }

  switch (verb) {
    case "go":
    case "move":
      return move(state, normalizeTarget(argument));
    case "look":
    case "l":
      return { state, messages: describeRoom(state) };
    case "examine":
    case "inspect": {
      const room = getRoom(state.roomId);
      const feature = room.features.find((candidate) =>
        matchesTarget(argument, candidate),
      );
      const creature = visibleCreatures(room, state).find((candidate) =>
        matchesTarget(argument, candidate),
      );
      const npc = findNpc(room, argument);
      const item = findCarriedItem(state, argument);
      return {
        state,
        messages: feature
          ? [message("narrative", feature.description)]
          : creature
            ? [message("narrative", creature.description)]
            : npc
              ? [message("narrative", npc.description)]
              : item
                ? [message("narrative", item.description)]
                : [
                    message(
                      "error",
                      `You find nothing notable about "${argument || "that"}."`,
                    ),
                  ],
      };
    }
    case "attack":
    case "kill":
      return attack(state, argument, nowMs);
    case "stop":
      return stopAttacking(state);
    case "cast":
      return cast(state, argument, nowMs);
    case "smite":
      return smite(state, argument, nowMs);
    case "pray":
      return pray(state);
    case "sneak":
      return state.discipline === "rogue"
        ? state.combat
          ? {
              state,
              messages: [message("error", "You cannot disappear while already engaged.")],
            }
          : {
              state: { ...state, sneaking: true },
              messages: [message("status", "You melt into the edges of the room.")],
            }
        : {
            state,
            messages: [message("error", "Only a Rogue can Sneak.")],
          };
    case "backstab":
      return backstab(state, argument, nowMs);
    case "resistance": {
      if (!state.discipline) {
        return { state, messages: [message("error", "Choose a discipline first.")] };
      }
      const discipline = disciplines[state.discipline];
      return {
        state,
        messages: [
          message(
            "status",
            `Magic resistance ${Math.round(discipline.magicResistance * 100)}% · Magical healing received ${Math.round(discipline.healingEffectiveness * 100)}%.`,
          ),
        ],
      };
    }
    case "guard":
      return state.discipline === "vanguard"
        ? {
            state: { ...state, guarding: true },
            messages: [message("status", "You set your guard for the next retaliation.")],
          }
        : {
            state,
            messages: [message("error", "Only a Vanguard can use Guard.")],
          };
    case "aim":
      return state.discipline === "wayfinder"
        ? {
            state: { ...state, aiming: true },
            messages: [message("status", "You steady your aim for the next attack.")],
          }
        : {
            state,
            messages: [message("error", "Only a Wayfinder can use Aim.")],
          };
    case "abilities":
    case "ability":
      return { state, messages: abilityMessages(state) };
    case "loot":
    case "get":
    case "take":
      return loot(state);
    case "equipment":
    case "eq":
      return { state, messages: equipmentMessages(state) };
    case "equip":
      return equip(state, argument);
    case "talk":
    case "speak":
      return talk(state, argument);
    case "accept":
      return acceptQuest(state, argument);
    case "quests":
    case "quest":
      return listQuests(state);
    case "rest": {
      if (state.combat) {
        return {
          state,
          messages: [message("error", "You cannot rest while something is trying to kill you.")],
        };
      }
      const health = Math.min(state.maxHealth, state.health + 8);
      const mana = Math.min(state.maxMana, state.mana + 6);
      return {
        state: { ...state, health, mana },
        messages: [
          message(
            "status",
            `You rest for a moment. Health: ${health}/${state.maxHealth}${state.maxMana > 0 ? ` · Mana: ${mana}/${state.maxMana}` : ""}.`,
          ),
        ],
      };
    }
    case "stats": {
      const discipline = state.discipline ? disciplines[state.discipline].name : "Unsworn";
      const nextLevel = state.level >= firstLightWorld.levelRange.max ? "MAX" : state.level * 100;
      return {
        state,
        messages: [
          message(
            "status",
            `${discipline} · Level ${state.level} · XP ${state.experience}/${nextLevel} · Health ${state.health}/${state.maxHealth}${state.maxMana > 0 ? ` · Mana ${state.mana}/${state.maxMana}` : ""}`,
          ),
          message(
            "system",
            `Might ${state.attributes.might} · Agility ${state.attributes.agility} · Intellect ${state.attributes.intellect} · Vitality ${state.attributes.vitality} · ${attacksPerVolley(state.attributes.agility)} hit(s) every ${(playerAttackIntervalMs(state.attributes.agility) / 1000).toFixed(2)}s · Crit ${criticalChance(state.attributes.agility)}% · Deaths ${state.deathCount}`,
          ),
        ],
      };
    }
    case "inventory":
    case "inv":
    case "i":
      return {
        state,
        messages: [
          message(
            "status",
            state.inventory.length > 0
              ? `You carry: ${state.inventory.map(itemName).join(", ")}.`
              : "You carry nothing.",
          ),
        ],
      };
    case "say":
      return {
        state,
        messages: [
          argument
            ? message("speech", `You say, “${argument}”`)
            : message("error", "Say what?"),
        ],
      };
    case "emote":
    case "em":
      return {
        state,
        messages: [
          argument
            ? message("narrative", `You ${argument}`)
            : message("error", "Emote what?"),
        ],
      };
    case "who":
      return {
        state,
        messages: [message("system", "You are the only traveler in this development realm.")],
      };
    case "help":
    case "?":
      return { state, messages: [message("system", helpText)] };
    default:
      return {
        state,
        messages: [
          message("error", `Unknown command: ${verb}. Type HELP for a command list.`),
        ],
      };
  }
}
