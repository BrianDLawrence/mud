import type { RoomStore } from "@/lib/game/room-store";
import { effectiveAttributes } from "@/lib/game/items";
import type { CharacterState } from "@/lib/game/types";

export function canNotice(perception: number, sneaking: boolean, stealthScore: number): boolean {
  return !sneaking || perception >= stealthScore;
}

export async function heartbeatRoom(
  store: RoomStore,
  characterId: string,
  characterName: string,
  roomId: string,
  state?: CharacterState,
) {
  const sneaking = Boolean(state?.sneaking);
  const stealthScore = sneaking && state ? effectiveAttributes(state).agility + 2 : 0;
  const change = await store.setPresence(characterId, characterName, roomId, sneaking, stealthScore);

  if (change.kind === "joined") {
    await store.appendEvent({
      roomId,
      type: "presence.entered",
      actorId: characterId,
      actorName: characterName,
      tone: "presence",
      text: `${characterName} enters.`,
      stealthScore: sneaking ? stealthScore : undefined,
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
        stealthScore: change.previousStealthScore,
      }),
      store.appendEvent({
        roomId,
        type: "presence.entered",
        actorId: characterId,
        actorName: characterName,
        tone: "presence",
        text: `${characterName} enters.`,
        stealthScore: sneaking ? stealthScore : undefined,
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
    stealthScore: presence.sneaking ? presence.stealthScore : undefined,
  });
}
