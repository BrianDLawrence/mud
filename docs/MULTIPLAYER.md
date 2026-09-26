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

## Player combat and visibility

`LOOK` and movement show other visible players in the room. `WHO` lists visible players. A Rogue can `SNEAK` before moving; departure and arrival messages, room listings, and player targeting hide the Rogue unless the observer's effective Intellect is at least the Rogue's effective Agility plus two. Speaking still reveals the speaker's words.

PvP is available in every room. It begins off for each character. `PVP ON` and `PVP OFF` change whether that character can initiate an attack; either mode can still receive an attack. Attempting `ATTACK <player>` or `A <player>` while PvP is off prompts `YES` or `NO`. `YES` enables PvP and makes one strike. Receiving a player attack enables PvP for retaliation. Player strikes use the existing Might, weapon power, armor, and Agility attack interval rules. Each PvP strike is a command; automatic PvP volleys are not part of this slice.

## Dying, aid, and lives

A hit at 0 HP or below makes a character helpless. Every 30 seconds they lose the greater of one HP or one percent of maximum HP, rounded up. At or below negative 25 percent of maximum HP, they die, including when one large hit crosses the threshold. Another player in the room can `AID <player>` to reverse the 30-second tick. `USE <healing item> ON <player>` and a Paladin's `PRAY <player>` apply immediate healing. Reaching positive HP restores consciousness.

Death counts against nine lives, whether caused by a creature or player. All inventory, equipped items, and gold become a public room drop. A player in the room can `LOOT` it. Death remains at the location until the player types `RESURRECT`, which returns them to the Lantern Inn at half HP and MP. The ninth death is permanent for that character. `RECREATE` starts a new character under the same account; the former character snapshot is archived instead of deleted.

The room feed and condition progression are derived from stored state during normal client polling, with no permanent game process. Drop publication is idempotent, and claimed drops retain a durable collected marker so retries cannot recreate them.
