import { NextResponse } from "next/server";
import { z } from "zod";
import { executeCommand } from "@/lib/game/engine";
import { publishDeath, settleCharacter } from "@/lib/game/character-service";
import { handleMultiplayerCommand, visiblePlayers } from "@/lib/game/multiplayer";
import { itemName } from "@/lib/game/items";
import { getPlayerCharacter } from "@/lib/game/player-character";
import { parseRoomCommand } from "@/lib/game/room-command";
import { heartbeatRoom } from "@/lib/game/room-service";
import { getRoomStore } from "@/lib/game/room-store";
import { getGameStore } from "@/lib/game/store";
import { characterSummary } from "@/lib/game/summary";
import { getAuthenticatedPlayer } from "@/lib/player-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const commandRequestSchema = z.object({
  command: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const parsed = commandRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a command between 1 and 500 characters." },
        { status: 400 },
      );
    }

    const player = await getAuthenticatedPlayer(request);
    if (!player) {
      return NextResponse.json(
        { error: "You must sign in before entering the realm." },
        { status: 401 },
      );
    }

    const store = getGameStore();
    const roomStore = getRoomStore();
    const resolvedCharacter = await getPlayerCharacter(store, player);
    const initialCharacter = resolvedCharacter
      ? await settleCharacter(store, roomStore, resolvedCharacter.id)
      : null;
    if (!initialCharacter) {
      return NextResponse.json(
        { error: "Create a character before entering the realm." },
        { status: 404 },
      );
    }

    const withinCommandLimit = await roomStore.checkRateLimit(
      resolvedCharacter!.id,
      "command",
      30,
      10,
    );
    if (!withinCommandLimit) {
      return NextResponse.json(
        { error: "You are acting too quickly. Pause for a moment." },
        { status: 429, headers: { "retry-after": "2" } },
      );
    }

    if (!["dead", "permadead"].includes(initialCharacter.character.state.lifeState ?? "alive")) {
      await heartbeatRoom(roomStore, resolvedCharacter!.id, initialCharacter.character.name,
        initialCharacter.character.state.roomId, initialCharacter.character.state);
    }

    const roomCommand = parseRoomCommand(parsed.data.command);
    if (roomCommand?.kind === "error") {
      return NextResponse.json({
        messages: [{ tone: "error", text: roomCommand.message }],
        character: characterSummary(initialCharacter.character.state),
      });
    }

    if (roomCommand?.kind === "who") {
      const names = (await visiblePlayers(roomStore, resolvedCharacter!.id,
        initialCharacter.character.state)).map((player) => player.name);
      return NextResponse.json({
        messages: [
          {
            tone: "status",
            text: `Present: ${names.length > 0 ? names.join(", ") : "no one else"}.`,
          },
        ],
        character: characterSummary(initialCharacter.character.state),
      });
    }

    if (roomCommand?.kind === "say" || roomCommand?.kind === "emote") {
      if (initialCharacter.character.state.lifeState !== "alive") return NextResponse.json({
        messages: [{ tone: "error", text: "You cannot speak while helpless or dead." }],
        character: characterSummary(initialCharacter.character.state),
      });
      const withinSocialLimit = await roomStore.checkRateLimit(
        resolvedCharacter!.id,
        "social",
        8,
        10,
      );
      if (!withinSocialLimit) {
        return NextResponse.json(
          { error: "Your voice needs a moment to recover." },
          { status: 429, headers: { "retry-after": "2" } },
        );
      }

      const characterName = initialCharacter.character.name;
      const isSpeech = roomCommand.kind === "say";
      await roomStore.appendEvent({
        roomId: initialCharacter.character.state.roomId,
        type: isSpeech ? "chat.say" : "chat.emote",
        actorId: resolvedCharacter!.id,
        actorName: characterName,
        tone: isSpeech ? "speech" : "narrative",
        text: isSpeech
          ? `${characterName} says, “${roomCommand.content}”`
          : `${characterName} ${roomCommand.content}`,
      });

      return NextResponse.json({
        messages: [
          {
            tone: isSpeech ? "speech" : "narrative",
            text: isSpeech
              ? `You say, “${roomCommand.content}”`
              : `You ${roomCommand.content}`,
          },
        ],
        character: characterSummary(initialCharacter.character.state),
      });
    }

    const multiplayer = await handleMultiplayerCommand(store, roomStore, resolvedCharacter!.id,
      initialCharacter.character, parsed.data.command);
    if (multiplayer) return NextResponse.json({ messages: multiplayer.messages,
      character: characterSummary(multiplayer.state) });

    const verb = parsed.data.command.trim().split(/\s+/)[0].toLowerCase();
    if (["loot", "get", "take"].includes(verb)) {
      if ((initialCharacter.character.state.lifeState ?? "alive") !== "alive") {
        return NextResponse.json({ messages: [{ tone: "error", text: "You cannot loot while helpless or dead." }],
          character: characterSummary(initialCharacter.character.state) });
      }
      const drops = await roomStore.listDrops(initialCharacter.character.state.roomId, resolvedCharacter!.id);
      const drop = drops[0];
      if (drop) {
        const claimed = await roomStore.claimDrop(drop.id, resolvedCharacter!.id);
        if (claimed) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const owned = await getPlayerCharacter(store, player);
            if (!owned || owned.character.state.roomId !== claimed.roomId) break;
            if (owned.character.state.claimedDropIds?.includes(claimed.id)) {
              await roomStore.completeDrop(claimed.id, resolvedCharacter!.id);
              return NextResponse.json({ messages: [{ tone: "status", text: "That cache is already yours." }],
                character: characterSummary(owned.character.state) });
            }
            const next = { ...owned.character.state,
              inventory: [...owned.character.state.inventory, ...claimed.itemIds],
              gold: owned.character.state.gold + claimed.gold,
              claimedDropIds: [...(owned.character.state.claimedDropIds ?? []), claimed.id] };
            if (await store.commit(owned.id, owned.character.version, next)) {
              await roomStore.completeDrop(claimed.id, resolvedCharacter!.id);
              return NextResponse.json({ messages: [{ tone: "experience",
                text: `You collect ${claimed.itemIds.map(itemName).join(", ") || "no items"} and ${claimed.gold} gold from ${claimed.ownerName}'s remains.` }],
                character: characterSummary(next) });
            }
          }
          return NextResponse.json({ error: "The cache shifted. Try LOOT again." }, { status: 409 });
        }
      }
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ownedCharacter = await getPlayerCharacter(store, player);
      if (!ownedCharacter) {
        return NextResponse.json(
          { error: "Create a character before entering the realm." },
          { status: 404 },
        );
      }
      const result = executeCommand(
        ownedCharacter.character.state,
        parsed.data.command,
      );
      const committed = await store.commit(
        ownedCharacter.id,
        ownedCharacter.character.version,
        result.state,
      );

      if (committed) {
        if (result.state.deathDrop?.id !== ownedCharacter.character.state.deathDrop?.id) {
          await publishDeath(store, roomStore, ownedCharacter.id, { ...ownedCharacter.character, state: result.state });
        }
        if (result.state.roomId !== ownedCharacter.character.state.roomId ||
          result.state.sneaking !== ownedCharacter.character.state.sneaking) {
          try {
            await heartbeatRoom(
              roomStore,
              ownedCharacter.id,
              ownedCharacter.character.name,
              result.state.roomId,
              result.state,
            );
          } catch (presenceError) {
            console.error("Room transition announcement failed", presenceError);
          }
        }

        const showingRoom = ["look", "l"].includes(verb) ||
          result.state.roomId !== ownedCharacter.character.state.roomId;
        const players = showingRoom
          ? await visiblePlayers(roomStore, ownedCharacter.id, result.state) : [];
        const drops = showingRoom
          ? await roomStore.listDrops(result.state.roomId) : [];
        const response = NextResponse.json({
          messages: [...result.messages,
            ...players.map((person) => ({ tone: "presence" as const, text: `${person.name} is here.` })),
            ...drops.map((drop) => ({ tone: "experience" as const,
              text: `On the ground: ${drop.itemIds.map(itemName).join(", ") || "no items"} and ${drop.gold} gold from ${drop.ownerName}. Type LOOT to take it.` }))],
          character: characterSummary(result.state),
        });

        return response;
      }
    }

    return NextResponse.json(
      { error: "The world shifted beneath you. Please try that command again." },
      { status: 409 },
    );
  } catch (error) {
    console.error("Command execution failed", error);
    return NextResponse.json(
      { error: "The realm is temporarily unavailable." },
      { status: 500 },
    );
  }
}
