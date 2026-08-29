import type { RoomStore } from "@/lib/game/room-store";

export async function heartbeatRoom(
  store: RoomStore,
  characterId: string,
  characterName: string,
  roomId: string,
) {
  const change = await store.setPresence(characterId, characterName, roomId);

  if (change.kind === "joined") {
    await store.appendEvent({
      roomId,
      type: "presence.entered",
      actorId: characterId,
      actorName: characterName,
      tone: "presence",
      text: `${characterName} enters.`,
    });
  } else if (change.kind === "moved" && change.previousRoomId) {
    await Promise.all([
      store.appendEvent({
        roomId: change.previousRoomId,
        type: "presence.left",
        actorId: characterId,
        actorName: characterName,
        tone: "presence",
        text: `${characterName} leaves.`,
      }),
      store.appendEvent({
        roomId,
        type: "presence.entered",
        actorId: characterId,
        actorName: characterName,
        tone: "presence",
        text: `${characterName} enters.`,
      }),
    ]);
  }

  return change;
}

export async function leaveRoom(
  store: RoomStore,
  characterId: string,
  characterName: string,
) {
  const presence = await store.removePresence(characterId);
  if (!presence) return;

  await store.appendEvent({
    roomId: presence.roomId,
    type: "presence.left",
    actorId: characterId,
    actorName: characterName,
    tone: "presence",
    text: `${characterName} leaves.`,
  });
}
