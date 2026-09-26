import { describe, expect, it } from "vitest";
import { createInitialCharacterState } from "@/lib/game/character-state";
import { publishDeath, settleCharacter } from "@/lib/game/character-service";
import { aidCharacter, advanceCondition, applyDamage, healCharacter, resurrect } from "@/lib/game/mortality";
import { MemoryRoomStore } from "@/lib/game/room-store";
import { MemoryGameStore } from "@/lib/game/store";

describe("mortality", () => {
  it("bleeds by one percent per 30 seconds and can recover with aid", () => {
    const initial = { ...createInitialCharacterState(), health: 2 };
    const hit = applyDamage(initial, 4, 1_000);
    expect(hit.state).toMatchObject({ health: -2, lifeState: "dying", deathCount: 0 });
    const bleeding = advanceCondition(hit.state, 31_000);
    expect(bleeding.state.health).toBe(-3);
    const aided = aidCharacter(bleeding.state, 31_000);
    expect(advanceCondition(aided, 61_000).state.health).toBe(-2);
    expect(healCharacter(aided, 4)).toMatchObject({ health: 1, lifeState: "alive" });
  });

  it("kills immediately at minus 25 percent, drops everything, and resurrects at the inn", () => {
    const initial = { ...createInitialCharacterState(), roomId: "root-cellar", health: 1,
      inventory: ["traveler-cloak", "copper-coins"], gold: 19 };
    const dead = applyDamage(initial, 14, 1_000).state;
    expect(dead).toMatchObject({ health: -13, lifeState: "dead", deathCount: 1,
      inventory: [], gold: 0, deathDrop: { roomId: "root-cellar", gold: 19 } });
    expect(dead.deathDrop?.itemIds).toEqual(initial.inventory);
    const revived = resurrect(dead).state;
    expect(revived).toMatchObject({ roomId: "lantern-inn", lifeState: "alive", health: 25,
      deathCount: 1 });
  });

  it("ends the ninth life but retains the archived character on recreation", async () => {
    const store = new MemoryGameStore();
    const created = await store.create("player", "Old Hero", "old hero");
    if (!created.created) throw new Error("character setup failed");
    const final = applyDamage({ ...created.character.state, deathCount: 8, health: 1 }, 14, 1_000).state;
    expect(final.lifeState).toBe("permadead");
    expect(await store.commit("player", 0, final)).toBe(true);
    const replacement = await store.create("player", "New Hero", "new hero");
    expect(replacement.created).toBe(true);
    expect((await store.get("player"))?.name).toBe("New Hero");
  });

  it("does not recreate a looted death drop when death publication retries", async () => {
    const store = new MemoryGameStore();
    const room = new MemoryRoomStore();
    const created = await store.create("alice", "Alice", "alice");
    if (!created.created) throw new Error("character setup failed");
    const state = applyDamage({ ...created.character.state, health: 1 }, 14, 1_000).state;
    await store.commit("alice", 0, state);
    const character = (await store.get("alice"))!;
    await publishDeath(store, room, "alice", character);
    const [drop] = await room.listDrops("lantern-inn");
    expect(drop.itemIds).toHaveLength(2);
    expect(await room.claimDrop(drop.id, "bob")).toBeTruthy();
    await room.completeDrop(drop.id, "bob");
    await publishDeath(store, room, "alice", (await store.get("alice"))!);
    expect(await room.listDrops("lantern-inn")).toEqual([]);
  });

  it("sends a private condition update when bleeding advances during another request", async () => {
    const store = new MemoryGameStore();
    const room = new MemoryRoomStore();
    const created = await store.create("alice", "Alice", "alice");
    if (!created.created) throw new Error("character setup failed");
    await store.commit("alice", 0, { ...created.character.state,
      health: -2, lifeState: "dying", conditionAt: 1_000 });
    await settleCharacter(store, room, "alice", 31_000);
    const feed = await room.readEvents("lantern-inn", "0", "alice");
    expect(feed.events.map((event) => event.text)).toEqual(["You are bleeding out at -3 HP."]);
    await settleCharacter(store, room, "alice", 31_000);
    expect((await room.readEvents("lantern-inn", "0", "alice")).events).toHaveLength(1);
  });
});
