import { describe, expect, it } from "vitest";
import { heartbeatRoom, leaveRoom } from "@/lib/game/room-service";
import { MemoryRoomStore } from "@/lib/game/room-store";

describe("Shared Room Alpha", () => {
  it("tracks presence and delivers new room events to other players", async () => {
    const store = new MemoryRoomStore();
    await heartbeatRoom(store, "alice", "Alice", "lantern-inn");
    const aliceCursor = await store.latestCursor("lantern-inn");
    expect(aliceCursor).toBe("1");

    await heartbeatRoom(store, "bob", "Bob", "lantern-inn");
    expect(await store.listPresent("lantern-inn")).toEqual(["Alice", "Bob"]);

    const feed = await store.readEvents(
      "lantern-inn",
      aliceCursor!,
      "alice",
    );
    expect(feed.cursor).toBe("2");
    expect(feed.events).toMatchObject([
      {
        type: "presence.entered",
        tone: "presence",
        text: "Bob enters.",
      },
    ]);
  });

  it("announces movement and explicit departure", async () => {
    const store = new MemoryRoomStore();
    await heartbeatRoom(store, "alice", "Alice", "lantern-inn");
    await heartbeatRoom(store, "bob", "Bob", "lantern-inn");
    const cursor = await store.latestCursor("lantern-inn");

    await heartbeatRoom(store, "alice", "Alice", "market-lane");
    const movement = await store.readEvents("lantern-inn", cursor!, "bob");
    expect(movement.events.map((event) => event.text)).toEqual(["Alice leaves."]);

    await leaveRoom(store, "bob", "Bob");
    expect(await store.listPresent("lantern-inn")).toEqual([]);
  });

  it("enforces fixed-window limits", async () => {
    const store = new MemoryRoomStore();
    expect(await store.checkRateLimit("alice", "social", 2, 10)).toBe(true);
    expect(await store.checkRateLimit("alice", "social", 2, 10)).toBe(true);
    expect(await store.checkRateLimit("alice", "social", 2, 10)).toBe(false);
    expect(await store.checkRateLimit("bob", "social", 2, 10)).toBe(true);
  });
});
