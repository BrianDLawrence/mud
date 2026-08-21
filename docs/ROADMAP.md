# Roadmap

The roadmap is ordered by risk reduction rather than feature count.

## Milestone 0 — Foundation (current)

- Text-only responsive terminal
- Semantic colored output
- Server-side command execution
- Small schema-validated world pack
- Optional MongoDB character persistence
- Optimistic concurrency
- Pure engine tests and CI
- Product, architecture, content, and contribution documentation

## Milestone 1 — Identity and durable alpha

- Better Auth with MongoDB
- Discord or Google OAuth plus one passwordless option
- Unique normalized account handles
- Character creation and names
- Production indexes and migrations/setup command
- Command idempotency and rate limits
- Append-only game event records

## Milestone 2 — Role-playing loop

- Attributes, classes or disciplines, equipment, and derived statistics
- Initiative/cooldown combat and death recovery
- NPCs, shops, quests, loot tables, and respawns
- Parties, room chat, tells, and presence
- Ten levels across a cohesive starting region
- Admin moderation and event inspection

## Milestone 3 — Extensible world

- Multi-zone content schema
- Content compiler and CLI validation
- Versioned publishing and rollback
- Quest graph and dialogue schema
- Encounter simulation and economy tests
- Author documentation and example packs

## Milestone 4 — Automation

- DSL grammar, parser, compiler, and static limits
- Browser-based online runner
- Script permissions and earned capabilities
- Execution trace and cancellation
- Natural-language-to-script assistant with explicit approval

## Milestone 5 — Multiplayer scale

- Realtime event fan-out
- Durable presence and disconnect handling
- Guilds, trade, mail, and shared storage
- Realm/zone partitioning guided by load tests
- Abuse prevention, retention policies, and operational dashboards

## Deferred decisions

- Final project and world name
- Character progression model
- PvP rules
- Offline automation
- Monetization
- Open-source license
- Dedicated game-server migration threshold
