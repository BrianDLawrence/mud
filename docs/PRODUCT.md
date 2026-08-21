# Product premise

## Vision

Build the next generation of the text-based multiplayer role-playing world: immediate enough to enter through a command prompt, deep enough to inhabit for years, and extensible enough that authors can keep opening new frontiers.

The experience should evoke the intimacy and imagination of a classic MUD without reproducing another game's protected setting, text, data, or progression.

## Non-negotiable experience rules

1. The primary game interface is text.
2. Color indicates semantic meaning: speech, danger, rewards, locations, system information, and errors.
3. Art is descriptive prose with rare, restrained ASCII decoration.
4. Characters gain experience, power, equipment, reputation, and access to new areas.
5. Repetitive play can be automated through a constrained game language.
6. AI assists players and world builders but does not become the authority for game state.
7. The world must expand through content packs rather than repeated engine rewrites.

## Player fantasy

The player is not navigating a website. They are addressing a living world:

```text
> listen at the iron door
Beyond the door, someone drags a chain across wet stone.

> whisper to mira "wait for my signal"
Mira nods once and extinguishes her lantern.
```

Commands should reward precision without requiring players to memorize every verb. Aliases, contextual help, tab completion, and eventually an AI command assistant can lower the learning curve without replacing the command line.

## Progression pillars

- **Character:** levels, attributes, disciplines, skills, and equipment.
- **Knowledge:** discovered routes, creature behavior, recipes, rumors, and secrets.
- **Social:** parties, guilds, trade, reputation, shared discoveries, and conflict.
- **Mastery:** command shortcuts and automation scripts earned and refined over time.
- **World:** regions unlock outward rather than merely increasing numeric difficulty.

## AI boundaries

Appropriate AI uses:

- Translate a player's stated goal into a proposed script.
- Draft a schema-valid room, quest, NPC, or dialogue tree for an author.
- Check tone, lore consistency, missing references, and content accessibility.
- Explain game commands in the context of the player's current situation.
- Add non-authoritative conversational flavor to explicitly AI-enabled NPCs.

Inappropriate AI uses:

- Determining hits, damage, loot, XP, ownership, or eligibility.
- Writing directly to character or economy collections.
- Silently issuing consequential commands for a player.
- Generating canonical content without validation and human publication.

## Early success criteria

The first public test succeeds when a new player can create an identity, enter a small region, understand the interface without external instructions, meet another player, survive an encounter, earn a meaningful reward, and return because the world suggests mysteries beyond the starting area.
