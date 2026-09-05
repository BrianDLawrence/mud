import { NextResponse } from "next/server";
import { z } from "zod";
import { executeCommand } from "@/lib/game/engine";
import { getPlayerCharacter } from "@/lib/game/player-character";
import { parseRoomCommand } from "@/lib/game/room-command";
import { heartbeatRoom } from "@/lib/game/room-service";
import { getRoomStore } from "@/lib/game/room-store";
import { getGameStore } from "@/lib/game/store";
import type { CharacterState } from "@/lib/game/types";
import { getAuthenticatedPlayer } from "@/lib/player-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const commandRequestSchema = z.object({
  command: z.string().trim().min(1).max(500),
});

function characterSummary(state: CharacterState) {
  return {
    discipline: state.discipline,
    health: state.health,
    maxHealth: state.maxHealth,
    mana: state.mana,
    maxMana: state.maxMana,
    experience: state.experience,
    level: state.level,
    inCombat: Boolean(state.combat),
    attacking: state.combat?.playerAttacking ?? false,
  };
}

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
    const initialCharacter = await getPlayerCharacter(store, player);
    if (!initialCharacter) {
      return NextResponse.json(
        { error: "Create a character before entering the realm." },
        { status: 404 },
      );
    }

    const withinCommandLimit = await roomStore.checkRateLimit(
      initialCharacter.id,
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

    await heartbeatRoom(
      roomStore,
      initialCharacter.id,
      initialCharacter.character.name,
      initialCharacter.character.state.roomId,
    );

    const roomCommand = parseRoomCommand(parsed.data.command);
    if (roomCommand?.kind === "error") {
      return NextResponse.json({
        messages: [{ tone: "error", text: roomCommand.message }],
        character: characterSummary(initialCharacter.character.state),
      });
    }

    if (roomCommand?.kind === "who") {
      const names = await roomStore.listPresent(
        initialCharacter.character.state.roomId,
      );
      return NextResponse.json({
        messages: [
          {
            tone: "status",
            text: `Present: ${names.length > 0 ? names.join(", ") : "no one"}.`,
          },
        ],
        character: characterSummary(initialCharacter.character.state),
      });
    }

    if (roomCommand?.kind === "say" || roomCommand?.kind === "emote") {
      const withinSocialLimit = await roomStore.checkRateLimit(
        initialCharacter.id,
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
        actorId: initialCharacter.id,
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
        if (result.state.roomId !== ownedCharacter.character.state.roomId) {
          try {
            await heartbeatRoom(
              roomStore,
              ownedCharacter.id,
              ownedCharacter.character.name,
              result.state.roomId,
            );
          } catch (presenceError) {
            console.error("Room transition announcement failed", presenceError);
          }
        }

        const response = NextResponse.json({
          messages: result.messages,
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
