# World content

Worlds are versioned data packs stored under `content/worlds/<world-id>/`. The server validates every pack before it becomes available to the engine.

## Current format

The `first-light` example demonstrates the initial schema:

```json
{
  "id": "first-light",
  "version": 1,
  "name": "The First Light",
  "entryRoomId": "lantern-inn",
  "levelRange": { "min": 1, "max": 5 },
  "rooms": []
}
```

Each room has a stable ID, description, exits, examinable features, creatures, and NPCs. A world pack can also define quests with an NPC giver, a defeat objective, dialogue for each stage, and XP/item rewards. Creature definitions can reference deterministic loot item IDs. IDs are machine-facing contracts: renaming display text is safe; changing a published ID requires a migration.

The validator checks room exits, NPC quest references, quest givers, quest creature targets, and item references at application start. Item mechanics live in `lib/game/items.ts`; world packs refer to those stable IDs rather than duplicating equipment rules.

## Authoring rules

- Write descriptions that imply choices instead of merely decorating a room.
- Keep the default room description concise enough for repeated visits.
- Put optional detail behind `examine`, `listen`, `smell`, and other interactions.
- Give landmarks memorable names that players can use when communicating routes.
- Ensure every danger has a clue and every important clue has a purpose.
- Use original content. Do not copy locations, prose, creatures, items, or progression data from existing games.

## Validation

The current validator verifies shape, entry-room existence, and exit targets at application start and during tests. It should grow to check:

- Globally unique room and entity IDs
- Reachability from zone entrances
- Bidirectional exits where intended
- Quest dependency cycles
- Missing item, spawn-table, script, and dialogue references
- Level and economy budgets
- Compatibility with the previous published version

## Publication model

Development packs live in Git and move through normal review. A future publishing command will validate the pack, assign an immutable release version, upload it to MongoDB, and update the realm's active content pointer. Existing encounters should retain the content version that created them until they finish.

AI-generated content follows exactly the same path: draft, validate, review, publish. AI never writes directly to the active world.
