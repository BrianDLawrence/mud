# Automatic combat

Combat is a server-authoritative exchange that continues after the initial `ATTACK <creature>` command.

## Player behavior

- `ATTACK <creature>` engages the target and performs the first attack volley immediately.
- Further player volleys and creature attacks occur when their stored timestamps become due.
- `STOP` disables future player volleys. It does not pacify the creature.
- Attacking the same creature again resumes a stopped attack immediately.
- Moving through an exit breaks engagement and escapes the creature.
- The status bar distinguishes `ATTACKING` from `UNDER ATTACK`.

Class commands can start or modify combat. Wayfinder `AIM` affects the next volley, Vanguard `GUARD` affects the next incoming attack, Arcanist `CAST EMBER` and Paladin `SMITE` open or continue an engagement, and Rogue `BACKSTAB` opens combat from `SNEAK` with a guaranteed critical hit.

## Timing on Vercel

No server process owns an in-memory timer. Active combat stores the next player and creature attack timestamps in the character snapshot. While combat exists, the terminal calls the authenticated combat endpoint once per second. The endpoint derives every due event, applies a bounded catch-up, and commits the next snapshot using the same optimistic version check as typed commands.

If a browser pauses or disconnects, elapsed combat can be resolved when polling resumes. At most twelve due attack events are processed in one request; remaining overdue timestamps are moved forward. This prevents an unbounded serverless request while preserving the fact that an engaged creature remains dangerous.

## Deterministic rolls

Agility controls three related values:

- below 4 Agility: one hit per volley;
- 4–6 Agility: two hits per volley;
- 7 or more Agility: three hits per volley;
- higher Agility shortens the delay between volleys and raises critical chance.

Critical rolls use combat sequence, relevant offensive stat, current creature HP, level, and XP. They are reproducible from authoritative state and cannot be supplied by the client. A critical hit doubles that strike's damage.

## Damage and resistance

World creatures declare physical or magic damage and an attack interval. Physical attacks are reduced by armor. Magic ignores armor and is reduced by discipline resistance. Witch Hunters resist 60% of magic but also receive only 50% of magical healing; ordinary rest is not magical and remains fully effective.

This milestone keeps combat per-character. Publishing attack events to the room and moving creature health into shared encounter state belong to Shared Combat Alpha.
