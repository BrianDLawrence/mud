import type { GameStore } from "@/lib/game/store";
import type { StoredCharacter } from "@/lib/game/types";
import type { PlayerIdentity } from "@/lib/player-identity";

export async function getPlayerCharacter(
  store: GameStore,
  player: PlayerIdentity,
): Promise<{ id: string; character: StoredCharacter } | null> {
  const character = await store.get(player.id);
  if (character) return { id: player.id, character };

  if (player.legacyId && player.legacyId !== player.id) {
    const legacyCharacter = await store.get(player.legacyId);
    if (legacyCharacter) {
      return { id: player.legacyId, character: legacyCharacter };
    }
  }

  return null;
}
