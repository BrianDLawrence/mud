# Shared Room Alpha

Shared Room Alpha makes the world socially present without requiring a permanent game server or sticky Vercel instance.

## Player behavior

- `WHO` lists active characters in the current room.
- `SAY <message>` broadcasts speech to the current room.
- `EMOTE <action>` broadcasts a narrative action to the current room.
- Movement publishes departure and arrival messages.
- Other players' room events appear in the terminal without requiring a command.

The speaker sees an immediate local rendering while other players receive the durable room event. The polling API excludes the viewer's own events so speech is never duplicated.

## Presence lifecycle

The terminal sends a heartbeat every fifteen seconds. A presence record expires after forty-five seconds without a heartbeat. Movement updates presence immediately, and sign-out or page closure sends a best-effort departure request. The expiration time—not browser cleanup—is authoritative when a client disappears unexpectedly.

MongoDB's TTL monitor deletes expired documents asynchronously, so every presence query also filters by `expiresAt`. A stale record therefore stops counting immediately even if physical deletion happens later.

## Event delivery

Room events are retained for seven days and ordered using opaque cursors. A client establishes its cursor when it joins, then polls every three seconds for newer events in its character's current room. Each response advances the cursor across all events, including filtered self-authored events.

This is deliberately transport-independent. A future managed realtime service can notify clients that events are available while MongoDB remains the durable source.

## Limits and moderation foundation

- Social messages are limited to 280 normalized characters.
- Control characters are rejected.
- Each character may issue 30 commands per ten seconds.
- Each character may publish eight social messages per ten seconds.
- Rate-limit counters expire automatically in MongoDB.

Public testing still requires moderation commands, reporting, blocking, retention review, and administrator event inspection.
