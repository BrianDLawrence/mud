import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getPlayerCharacter } from "@/lib/game/player-character";
import { heartbeatRoom, leaveRoom } from "@/lib/game/room-service";
import { getRoomStore } from "@/lib/game/room-store";
import { getGameStore } from "@/lib/game/store";
import { getAuthenticatedPlayer } from "@/lib/player-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveCharacter(request: Request) {
  const player = await getAuthenticatedPlayer(request);
  if (!player) return null;
  const ownedCharacter = await getPlayerCharacter(getGameStore(), player);
  return ownedCharacter ? { player, ...ownedCharacter } : null;
}

export async function POST(request: Request) {
  try {
    const resolved = await resolveCharacter(request);
    if (!resolved) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const roomStore = getRoomStore();
    await heartbeatRoom(
      roomStore,
      resolved.id,
      resolved.character.name,
      resolved.character.state.roomId,
    );
    const cursor = await roomStore.latestCursor(resolved.character.state.roomId);

    return NextResponse.json({ cursor });
  } catch (error) {
    console.error("Room heartbeat failed", error);
    return NextResponse.json(
      { error: "Room presence is temporarily unavailable." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const resolved = await resolveCharacter(request);
    if (!resolved) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const url = new URL(request.url);
    const after = url.searchParams.get("after");
    if (!after) {
      return NextResponse.json({ error: "An event cursor is required." }, { status: 400 });
    }
    if (
      process.env.MONGODB_URI &&
      (!/^[a-f\d]{24}$/i.test(after) || !ObjectId.isValid(after))
    ) {
      return NextResponse.json({ error: "Invalid event cursor." }, { status: 400 });
    }
    if (!process.env.MONGODB_URI && !/^\d+$/.test(after)) {
      return NextResponse.json({ error: "Invalid event cursor." }, { status: 400 });
    }

    const feed = await getRoomStore().readEvents(
      resolved.character.state.roomId,
      after,
      resolved.id,
    );
    return NextResponse.json(feed, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("Room event polling failed", error);
    return NextResponse.json(
      { error: "Room events are temporarily unavailable." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const resolved = await resolveCharacter(request);
    if (!resolved) return new Response(null, { status: 204 });

    await leaveRoom(getRoomStore(), resolved.id, resolved.character.name);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Room departure failed", error);
    return new Response(null, { status: 204 });
  }
}
