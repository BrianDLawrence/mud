import { advanceCondition } from "@/lib/game/mortality";
import type { RoomStore } from "@/lib/game/room-store";
import type { GameStore } from "@/lib/game/store";
import type { StoredCharacter } from "@/lib/game/types";

export async function publishDeath(
  store: GameStore,
  roomStore: RoomStore,
  characterId: string,
  character: StoredCharacter,
): Promise<StoredCharacter> {
  const drop = character.state.deathDrop;
  if (!drop || character.state.deathDropPublishedId === drop.id) return character;
  const id = `${characterId}:${drop.id}`;
  await roomStore.putDrop({ id, roomId: drop.roomId, itemIds: drop.itemIds,
    gold: drop.gold, ownerName: character.name });
  await roomStore.appendEvent({
    roomId: drop.roomId,
    type: "condition.player",
    actorId: characterId,
    actorName: character.name,
    tone: "combat",
    text: `${character.name} dies. Their possessions fall to the ground.`,
    sourceId: `death:${id}`,
  });
  if (character.state.lifeState === "dead" || character.state.lifeState === "permadead") {
    await roomStore.removePresence(characterId);
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await store.get(characterId);
    if (!current || current.state.deathDrop?.id !== drop.id) return character;
    if (current.state.deathDropPublishedId === drop.id) return current;
    const nextState = { ...current.state, deathDropPublishedId: drop.id };
    if (await store.commit(characterId, current.version, nextState)) {
      return { ...current, state: nextState, version: current.version + 1 };
    }
  }
  return character;
}

export async function settleCharacter(
  store: GameStore,
  roomStore: RoomStore,
  characterId: string,
  nowMs = Date.now(),
): Promise<{ character: StoredCharacter; messages: ReturnType<typeof advanceCondition>["messages"] } | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const character = await store.get(characterId);
    if (!character) return null;
    const result = advanceCondition(character.state, nowMs);
    if (result.messages.length === 0) {
      const published = character.state.deathDrop
        ? await publishDeath(store, roomStore, characterId, character) : character;
      return { character: published, messages: [] };
    }
    if (await store.commit(characterId, character.version, result.state)) {
      const next = { ...character, state: result.state, version: character.version + 1 };
      for (const [index, notice] of result.messages.entries()) {
        await roomStore.appendEvent({ roomId: next.state.roomId, type: "condition.player",
          actorId: "world", actorName: "World", audienceId: characterId,
          tone: notice.tone, text: notice.text,
          sourceId: `condition:${characterId}:${next.version}:${index}` });
      }
      const published = next.state.deathDrop
        ? await publishDeath(store, roomStore, characterId, next) : next;
      return { character: published, messages: result.messages };
    }
  }
  return null;
}
