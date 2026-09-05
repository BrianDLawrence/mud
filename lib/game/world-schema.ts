import { z } from "zod";

const directionSchema = z.enum([
  "north",
  "south",
  "east",
  "west",
  "up",
  "down",
]);

const featureSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  description: z.string().min(1),
});

const creatureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  description: z.string().min(1),
  health: z.number().int().positive(),
  damage: z.number().int().nonnegative(),
  experience: z.number().int().nonnegative(),
  loot: z.array(z.string().min(1)).default([]),
});

const npcSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  description: z.string().min(1),
  dialogue: z.string().min(1),
  questIds: z.array(z.string().min(1)).default([]),
});

const questSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  giverNpcId: z.string().min(1),
  summary: z.string().min(1),
  objective: z.object({
    type: z.literal("defeat"),
    creatureId: z.string().min(1),
  }),
  reward: z.object({
    experience: z.number().int().nonnegative(),
    itemIds: z.array(z.string().min(1)).default([]),
  }),
  offeredDialogue: z.string().min(1),
  activeDialogue: z.string().min(1),
  readyDialogue: z.string().min(1),
  completionDialogue: z.string().min(1),
});

const roomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  exits: z.partialRecord(directionSchema, z.string().min(1)),
  features: z.array(featureSchema).default([]),
  creatures: z.array(creatureSchema).default([]),
  npcs: z.array(npcSchema).default([]),
});

export const worldPackSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    name: z.string().min(1),
    entryRoomId: z.string().min(1),
    levelRange: z.object({
      min: z.number().int().positive(),
      max: z.number().int().positive(),
    }),
    quests: z.array(questSchema).default([]),
    rooms: z.array(roomSchema).min(1),
  })
  .superRefine((world, context) => {
    const roomIds = new Set(world.rooms.map((room) => room.id));
    const npcIds = new Set(world.rooms.flatMap((room) => room.npcs.map((npc) => npc.id)));
    const creatureIds = new Set(
      world.rooms.flatMap((room) => room.creatures.map((creature) => creature.id)),
    );
    const questIds = new Set(world.quests.map((quest) => quest.id));

    if (!roomIds.has(world.entryRoomId)) {
      context.addIssue({
        code: "custom",
        path: ["entryRoomId"],
        message: "Entry room does not exist in this world pack.",
      });
    }

    for (const [roomIndex, room] of world.rooms.entries()) {
      for (const [direction, destination] of Object.entries(room.exits)) {
        if (!roomIds.has(destination)) {
          context.addIssue({
            code: "custom",
            path: ["rooms", roomIndex, "exits", direction],
            message: `Exit points to missing room: ${destination}`,
          });
        }
      }

      for (const [npcIndex, npc] of room.npcs.entries()) {
        for (const [questIndex, questId] of npc.questIds.entries()) {
          if (!questIds.has(questId)) {
            context.addIssue({
              code: "custom",
              path: ["rooms", roomIndex, "npcs", npcIndex, "questIds", questIndex],
              message: `NPC references missing quest: ${questId}`,
            });
          }
        }
      }
    }

    for (const [questIndex, quest] of world.quests.entries()) {
      if (!npcIds.has(quest.giverNpcId)) {
        context.addIssue({
          code: "custom",
          path: ["quests", questIndex, "giverNpcId"],
          message: `Quest giver does not exist: ${quest.giverNpcId}`,
        });
      }
      if (!creatureIds.has(quest.objective.creatureId)) {
        context.addIssue({
          code: "custom",
          path: ["quests", questIndex, "objective", "creatureId"],
          message: `Quest target does not exist: ${quest.objective.creatureId}`,
        });
      }
    }
  });

export type WorldPack = z.infer<typeof worldPackSchema>;
export type Room = WorldPack["rooms"][number];
export type Creature = Room["creatures"][number];
export type Npc = Room["npcs"][number];
export type Quest = WorldPack["quests"][number];
