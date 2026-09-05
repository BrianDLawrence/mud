# NextMUD

NextMUD is a text-first, automation-ready multiplayer role-playing world inspired by the social immediacy of classic MUDs. Text is the interface. Color communicates meaning. The server owns the rules.

This repository is an architectural foundation and playable vertical slice. It currently includes a level 1–3 adventure, three character disciplines, deterministic combat and class abilities, equipment and loot, an NPC quest and boss, Discord authentication, account-owned character creation, MongoDB persistence, world-pack validation, tests, and a terminal-like web client.

## Project principles

- **Text is the product.** Descriptions and restrained ASCII art replace graphical UI.
- **Rules are deterministic.** AI may propose commands or content, but it cannot award loot, decide combat, or mutate state directly.
- **Automation is a game system.** Players eventually receive a limited, inspectable scripting language—not arbitrary JavaScript.
- **Content is data.** Versioned world packs make new zones independently authorable and testable.
- **The server is authoritative.** Clients submit commands, never character state.
- **Start serverless; preserve an exit.** The first runtime targets Vercel and MongoDB without coupling the domain engine to either.

Read [the product premise](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md), [authentication setup](docs/AUTHENTICATION.md), [Discord Activity setup](docs/DISCORD_ACTIVITY.md), [Shared Room Alpha design](docs/MULTIPLAYER.md), [First Adventure design](docs/FIRST_ADVENTURE.md), [world-authoring guide](docs/WORLD_CONTENT.md), and [roadmap](docs/ROADMAP.md) before making a substantial change.

## Quick start

Requirements: Node.js 22 LTS or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Complete the Discord and MongoDB values described in [the authentication guide](docs/AUTHENTICATION.md), then open `http://localhost:3000`. Sign in, create a character, and type `help`.

Useful commands:

```bash
npm test
npm run lint
npm run build
```

## Current gameplay

The initial realm supports verified accounts, unique character names, shared room presence, live speech and emotes, room descriptions, movement, examination, three disciplines, inventory and equipment, abilities, deterministic combat, loot, death recovery, quests, a boss, and level progression. New and existing characters choose a permanent alpha discipline before entering. Try:

```text
talk keeper
accept orchard
north
examine tracks
north
attack crawler
loot
equip crawler chitin
down
attack keeper
quests
who
say The northern road is open.
emote studies the pale fruit
```

## Repository map

```text
app/                         Next.js UI and HTTP endpoints
components/                  Terminal client
content/worlds/              Versioned world packs
docs/                        Product and engineering decisions
lib/game/                    Framework-independent rules and persistence boundary
lib/mongodb.ts               Reused MongoDB client
.github/                     Contribution and CI configuration
```

## Persistence and deployment

Set `MONGODB_URI` and optionally `MONGODB_DATABASE`. The MongoDB store uses optimistic version checks so concurrent commands cannot silently overwrite each other. Better Auth stores Discord-linked identities and sessions in the same database; gameplay endpoints validate the session on every request.

The intended first deployment target is Vercel with MongoDB Atlas. The same deployment can run as a normal website or inside a Discord Activity. Both paths resolve the player's Discord identity to the same character. The alpha permits one character per account. Authentication and character names are intentionally separate identities.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). A project license has intentionally not been selected yet; choose one before accepting public contributions.
