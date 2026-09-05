# First Adventure

The First Adventure turns the framework into a complete level 1–3 role-playing loop. It is intentionally compact: every system has enough content to prove that it works without hiding the rules behind a large world.

## Character disciplines

Every new or existing unsworn character chooses one permanent discipline before entering the terminal:

| Discipline | Strength | Signature command | Starting resource |
|---|---|---|---|
| Vanguard | Might, vitality, and health | `GUARD` reduces the next retaliation | 64 HP |
| Wayfinder | Agility and deliberate weapon attacks | `AIM` adds damage to the next attack | 52 HP |
| Arcanist | Intellect and focused spell damage | `CAST EMBER <target>` costs 6 mana | 46 HP / 28 MP |

The choice grants and equips a discipline starter item. The server owns the choice and rejects attempts to change it. The web and Discord Activity clients use the same endpoint and character state.

## Adventure path

1. `TALK KEEPER` at the Copper Lantern.
2. `ACCEPT ORCHARD` to begin **Beneath Black Roots**.
3. Travel north to the Drowned Orchard and defeat the marsh crawler.
4. `LOOT`, then `EQUIP CRAWLER CHITIN` for improved armor.
5. Travel `DOWN` and defeat the rootbound keeper.
6. Return to Keeper Vale and `TALK KEEPER` to complete the quest.

The crawler, boss, and quest reward total 200 XP, bringing a new character to level 3. Level-ups increase maximum health, increase maximum mana for mana users, and fully restore both resources.

## Deterministic rules

- Maximum HP is derived from Vitality and level; mana unlocks at high Intellect and scales with level.
- Weapon damage is derived from Might, the equipped weapon, and an optional Aim bonus.
- Ember damage is derived from Intellect and the equipped focus.
- Incoming damage is reduced by equipped armor and an optional Guard bonus.
- A creature retaliates after any attack that does not defeat it.
- Loot remains on the ground in the room until the character uses `LOOT`.
- Rest restores HP and MP outside combat only.
- Defeat returns the character to the Copper Lantern at half HP and MP. Experience, inventory, equipment, quests, and defeated creatures are retained.

All calculations happen in the framework-independent command engine. The browser submits text and renders semantic messages; it never decides damage, rewards, or progression.

## Existing character migration

Character snapshots are normalized when loaded. Legacy inventory display strings are mapped to stable item IDs, and new fields receive safe defaults. Existing characters retain their room, HP, XP, inventory, and defeated-creature progress, then choose a discipline through the same onboarding gate as a new character. The normalized snapshot is persisted by the next successful compare-and-set update, so no one-off database migration is required for this milestone.

## Intentional limits

The boss is currently per-character, not a shared party encounter. Creatures do not respawn, shops are not implemented, and discipline selection cannot be reset through the UI. Those are explicit follow-on systems rather than hidden client behavior.
