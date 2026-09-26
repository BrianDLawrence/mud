import { livesRemaining } from "@/lib/game/mortality";
import type { CharacterState, CharacterSummary } from "@/lib/game/types";

export function characterSummary(state: CharacterState): CharacterSummary {
  return {
    discipline: state.discipline,
    health: state.health,
    maxHealth: state.maxHealth,
    mana: state.mana,
    maxMana: state.maxMana,
    experience: state.experience,
    level: state.level,
    inCombat: Boolean(state.combat),
    attacking: state.combat?.playerAttacking ?? false,
    lifeState: state.lifeState ?? "alive",
    livesRemaining: livesRemaining(state),
    pvpEnabled: Boolean(state.pvpEnabled),
  };
}
