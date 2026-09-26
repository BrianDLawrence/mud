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

  it("hides sneaking movement and presence until Intellect meets stealth", async () => {
    const store = new MemoryRoomStore();
    await store.setPresence("alice", "Alice", "lantern-inn", false, 0);
    const cursor = await store.latestCursor("lantern-inn");
    await store.setPresence("bob", "Bob", "lantern-inn", true, 8);
    await store.appendEvent({ roomId: "lantern-inn", type: "presence.entered",
      actorId: "bob", actorName: "Bob", tone: "presence", text: "Bob enters.", stealthScore: 8 });
    expect((await store.listOccupants("lantern-inn")).find((person) => person.name === "Bob"))
      .toMatchObject({ sneaking: true, stealthScore: 8 });
    const hidden = await store.readEvents("lantern-inn", cursor ?? "0", "alice", 7);
    expect(hidden.events).toEqual([]);
    const noticed = await store.readEvents("lantern-inn", cursor ?? "0", "alice", 8);
    expect(noticed.events.map((event) => event.text)).toEqual(["Bob enters."]);
  });

  it("delivers private injury notices only to their target", async () => {
    const store = new MemoryRoomStore();
    await store.appendEvent({ roomId: "lantern-inn", type: "condition.player",
      actorId: "alice", actorName: "Alice", tone: "combat", text: "You collapse.",
      audienceId: "bob" });
    expect((await store.readEvents("lantern-inn", "0", "bob")).events).toHaveLength(1);
    expect((await store.readEvents("lantern-inn", "0", "charlie")).events).toHaveLength(0);
  });
});
