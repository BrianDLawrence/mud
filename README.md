# NextMUD

NextMUD is a text-first, automation-ready multiplayer role-playing world inspired by the social immediacy of classic MUDs. Text is the interface. Color communicates meaning. The server owns the rules.

This repository is an architectural foundation and playable vertical slice. It currently includes a small development realm, a server-side command engine, guest sessions, optional MongoDB persistence, world-pack validation, tests, and a terminal-like web client.

## Project principles

- **Text is the product.** Descriptions and restrained ASCII art replace graphical UI.
- **Rules are deterministic.** AI may propose commands or content, but it cannot award loot, decide combat, or mutate state directly.
- **Automation is a game system.** Players eventually receive a limited, inspectable scripting language—not arbitrary JavaScript.
- **Content is data.** Versioned world packs make new zones independently authorable and testable.
- **The server is authoritative.** Clients submit commands, never character state.
- **Start serverless; preserve an exit.** The first runtime targets Vercel and MongoDB without coupling the domain engine to either.

Read [the product premise](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md), [world-authoring guide](docs/WORLD_CONTENT.md), and [roadmap](docs/ROADMAP.md) before making a substantial change.

## Quick start

Requirements: Node.js 22 LTS or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` and type `help`. Without `MONGODB_URI`, local development uses a process-local memory store. That fallback is intentionally rejected in a Vercel production environment.

Useful commands:

```bash
npm test
npm run lint
npm run build
```

## Current gameplay

The initial realm supports room descriptions, movement, examination, speech, inventory, stats, rest, and a small combat encounter. Try:

```text
north
examine tracks
north
attack crawler
stats
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

Set `MONGODB_URI` and optionally `MONGODB_DATABASE`. The MongoDB store uses optimistic version checks so concurrent commands cannot silently overwrite each other. The current guest cookie is a development bridge, not production authentication.

The intended first deployment target is Vercel with MongoDB Atlas. Authentication with Better Auth and verified OAuth/email identity is the next infrastructure milestone.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). A project license has intentionally not been selected yet; choose one before accepting public contributions.
