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
});

const roomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  exits: z.partialRecord(directionSchema, z.string().min(1)),
  features: z.array(featureSchema).default([]),
  creatures: z.array(creatureSchema).default([]),
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
    rooms: z.array(roomSchema).min(1),
  })
  .superRefine((world, context) => {
    const roomIds = new Set(world.rooms.map((room) => room.id));

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
    }
  });

export type WorldPack = z.infer<typeof worldPackSchema>;
export type Room = WorldPack["rooms"][number];
export type Creature = Room["creatures"][number];
