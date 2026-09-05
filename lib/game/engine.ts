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
  "guard / aim / cast ember <creature>",
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

function sufferRetaliation(
  state: CharacterState,
  creature: Creature,
  creatureHealth: number,
): CommandResult {
  const guardReduction = state.guarding ? 4 : 0;
  const minimumDamage = creature.damage > 0 ? 1 : 0;
  const damage = Math.max(
    minimumDamage,
    creature.damage - equipmentArmor(state.equipment) - guardReduction,
  );
  const health = Math.max(0, state.health - damage);
  const combatState: CharacterState = {
    ...state,
    health,
    guarding: undefined,
    combat: {
      creatureId: creature.id,
      roomId: state.roomId,
      health: creatureHealth,
    },
  };
  const messages = [
    message(
      "combat",
      state.guarding
        ? `${creature.name} strikes your guard for ${damage} damage.`
        : `${creature.name} strikes you for ${damage} damage.`,
    ),
  ];

  if (health > 0) {
    return {
      state: combatState,
      messages: [
        ...messages,
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
    },
    messages: [
      ...messages,
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

function resolveAttack(
  state: CharacterState,
  creature: Creature,
  damage: number,
  attackDescription: string,
): CommandResult {
  const currentHealth =
    state.combat?.creatureId === creature.id
      ? state.combat.health
      : creature.health;
  const remainingHealth = Math.max(0, currentHealth - damage);
  const attackState = { ...state, aiming: undefined };
  const strike = message(
    "combat",
    `${attackDescription} ${creature.name} for ${damage} damage.`,
  );

  if (remainingHealth === 0) {
    const result = defeatCreature(attackState, creature);
    return { state: result.state, messages: [strike, ...result.messages] };
  }

  const retaliation = sufferRetaliation(attackState, creature, remainingHealth);
  return {
    state: retaliation.state,
    messages: [strike, ...retaliation.messages],
  };
}

function findVisibleCreature(
  state: CharacterState,
  target: string,
): Creature | undefined {
  return visibleCreatures(getRoom(state.roomId), state).find((candidate) =>
    matchesTarget(target, candidate),
  );
}

function attack(state: CharacterState, target: string): CommandResult {
  const creature = findVisibleCreature(state, target);
  if (!creature) {
    return {
      state,
      messages: [message("error", `You see no "${target || "target"}" here.`)],
    };
  }

  const aimedBonus = state.aiming ? 4 : 0;
  const damage =
    3 +
    Math.floor(state.attributes.might / 2) +
    equipmentPower(state.equipment, "weapon") +
    aimedBonus;
  return resolveAttack(
    state,
    creature,
    damage,
    state.aiming ? "Your carefully aimed strike hits" : "You strike",
  );
}

function cast(state: CharacterState, argument: string): CommandResult {
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

  const castingState = { ...state, mana: state.mana - 6 };
  const damage =
    5 +
    state.attributes.intellect +
    equipmentPower(state.equipment, "focus");
  const result = resolveAttack(
    castingState,
    creature,
    damage,
    "Your ember burns",
  );
  return {
    state: result.state,
    messages: [
      message("status", `You spend 6 mana. ${castingState.mana}/${state.maxMana} remain.`),
      ...result.messages,
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
    message("system", `Armor ${equipmentArmor(state.equipment)}.`),
  ];
}

export function executeCommand(
  currentState: CharacterState,
  rawCommand: string,
): CommandResult {
  const state = normalizeCharacterState(currentState);
  const command = rawCommand.trim();

  if (!command) return { state, messages: [] };

  const [verbToken = "", ...argumentTokens] = command.split(/\s+/);
  const verb = verbToken.toLocaleLowerCase();
  const argument = argumentTokens.join(" ");

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
      return attack(state, argument);
    case "cast":
      return cast(state, argument);
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
            `Might ${state.attributes.might} · Agility ${state.attributes.agility} · Intellect ${state.attributes.intellect} · Vitality ${state.attributes.vitality} · Deaths ${state.deathCount}`,
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
