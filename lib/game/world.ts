import rawWorld from "@/content/worlds/first-light/world.json";
import { worldPackSchema, type Room } from "@/lib/game/world-schema";

export const firstLightWorld = worldPackSchema.parse(rawWorld);

const roomsById = new Map(
  firstLightWorld.rooms.map((room) => [room.id, room] as const),
);

export function getRoom(roomId: string): Room {
  const room = roomsById.get(roomId);

  if (!room) {
    throw new Error(`World pack references an unknown room: ${roomId}`);
  }

  return room;
}
