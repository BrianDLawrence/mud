import rawWorld from "@/content/worlds/first-light/world.json";
import { items } from "@/lib/game/items";
import { worldPackSchema, type Room } from "@/lib/game/world-schema";

export const firstLightWorld = worldPackSchema.parse(rawWorld);

for (const itemId of [
  ...firstLightWorld.rooms.flatMap((room) =>
    room.creatures.flatMap((creature) => creature.loot),
  ),
  ...firstLightWorld.quests.flatMap((quest) => quest.reward.itemIds),
]) {
  if (!items.has(itemId)) {
    throw new Error(`World pack references an unknown item: ${itemId}`);
  }
}

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
