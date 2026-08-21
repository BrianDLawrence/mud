import type { Creature, Room } from "@/lib/game/world-schema";
import { firstLightWorld, getRoom } from "@/lib/game/world";
import type {
  CharacterState,
  CommandResult,
  GameMessage,
} from "@/lib/game/types";

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
  "north/south/east/west",
  "go <direction>",
  "attack <creature>",
  "rest",
  "stats",
  "inventory",
  "say <message>",
  "who",
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

function visibleCreatures(room: Room, state: CharacterState): Creature[] {
  return room.creatures.filter(
    (creature) => !state.defeatedCreatureIds.includes(creature.id),
  );
}

function describeRoom(state: CharacterState): GameMessage[] {
  const room = getRoom(state.roomId);
  const exits = Object.keys(room.exits);
  const creatures = visibleCreatures(room, state);

  return [
    message("location", room.name),
    message("narrative", room.description),
    ...(creatures.length > 0
      ? creatures.flatMap((creature) => [
          message("combat", `${creature.name} is here.`),
          message("narrative", creature.description),
        ])
      : []),
    message(
      "exits",
      `Obvious exits: ${exits.length > 0 ? exits.join(", ") : "none"}`,
    ),
  ];
}

export function createInitialCharacterState(): CharacterState {
  return {
    roomId: firstLightWorld.entryRoomId,
    health: 50,
    maxHealth: 50,
    experience: 0,
    level: 1,
    inventory: ["worn traveler's cloak", "three copper coins"],
    defeatedCreatureIds: [],
  };
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

  const nextState = { ...state, roomId: destination, combat: undefined };
  return { state: nextState, messages: describeRoom(nextState) };
}

function attack(state: CharacterState, target: string): CommandResult {
  const room = getRoom(state.roomId);
  const creature = visibleCreatures(room, state).find((candidate) =>
    matchesTarget(target, candidate),
  );

  if (!creature) {
    return {
      state,
      messages: [message("error", `You see no "${target || "target"}" here.`)],
    };
  }

  const currentHealth =
    state.combat?.creatureId === creature.id ? state.combat.health : creature.health;
  const playerDamage = 6;
  const remainingHealth = Math.max(0, currentHealth - playerDamage);
  const messages = [
    message("combat", `You strike ${creature.name} for ${playerDamage} damage.`),
  ];

  if (remainingHealth === 0) {
    const experience = state.experience + creature.experience;
    const level = Math.floor(experience / 100) + 1;
    messages.push(
      message("combat", `${creature.name} collapses into the black water.`),
      message("experience", `You gain ${creature.experience} experience.`),
    );

    return {
      state: {
        ...state,
        experience,
        level,
        combat: undefined,
        defeatedCreatureIds: [...state.defeatedCreatureIds, creature.id],
      },
      messages,
    };
  }

  const health = Math.max(0, state.health - creature.damage);
  messages.push(
    message("combat", `${creature.name} claws you for ${creature.damage} damage.`),
    message("status", `You have ${health}/${state.maxHealth} health.`),
  );

  return {
    state: {
      ...state,
      health,
      combat: { creatureId: creature.id, roomId: room.id, health: remainingHealth },
    },
    messages,
  };
}

export function executeCommand(
  currentState: CharacterState,
  rawCommand: string,
): CommandResult {
  const state: CharacterState = {
    ...currentState,
    inventory: [...currentState.inventory],
    defeatedCreatureIds: [...currentState.defeatedCreatureIds],
    combat: currentState.combat ? { ...currentState.combat } : undefined,
  };
  const command = rawCommand.trim();

  if (!command) {
    return { state, messages: [] };
  }

  const [verbToken = "", ...argumentTokens] = command.split(/\s+/);
  const verb = verbToken.toLocaleLowerCase();
  const argument = argumentTokens.join(" ");

  if (["n", "s", "e", "w", "u", "d", "north", "south", "east", "west", "up", "down"].includes(verb)) {
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
      return {
        state,
        messages: feature
          ? [message("narrative", feature.description)]
          : creature
            ? [message("narrative", creature.description)]
            : [message("error", `You find nothing notable about "${argument || "that"}".`)],
      };
    }
    case "attack":
    case "kill":
      return attack(state, argument);
    case "rest": {
      const health = Math.min(state.maxHealth, state.health + 5);
      return {
        state: { ...state, health },
        messages: [
          message("status", `You rest for a moment. Health: ${health}/${state.maxHealth}.`),
        ],
      };
    }
    case "stats":
      return {
        state,
        messages: [
          message(
            "status",
            `Level ${state.level} · XP ${state.experience} · Health ${state.health}/${state.maxHealth}`,
          ),
        ],
      };
    case "inventory":
    case "inv":
    case "i":
      return {
        state,
        messages: [
          message(
            "status",
            state.inventory.length > 0
              ? `You carry: ${state.inventory.join(", ")}.`
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
