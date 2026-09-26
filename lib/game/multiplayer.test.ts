import { describe, expect, it } from "vitest";
import { grantItems } from "./items";
import { chooseDiscipline } from "@/lib/game/disciplines";
import { handleMultiplayerCommand } from "@/lib/game/multiplayer";
import { heartbeatRoom } from "@/lib/game/room-service";
import { MemoryRoomStore } from "@/lib/game/room-store";
import { MemoryGameStore } from "@/lib/game/store";

async function setup() {
  const store = new MemoryGameStore();
  const room = new MemoryRoomStore();
  for (const [id, name] of [["alice", "Alice"], ["bob", "Bob"]]) {
    const created = await store.create(id, name, name.toLowerCase());
    if (!created.created) throw new Error("character setup failed");
    await store.commit(id, 0, chooseDiscipline(created.character.state,
      id === "alice" ? "paladin" : "vanguard"));
    const character = await store.get(id);
    await heartbeatRoom(room, id, name, "lantern-inn", character!.state);
  }
  return { store, room };
}

describe("player interactions", () => {
  it("requires PvP confirmation and enables retaliation when struck", async () => {
    const { store, room } = await setup();
    const first = await handleMultiplayerCommand(store, room, "alice", (await store.get("alice"))!, "a Bob", 1_000);
    expect(first?.messages[0].text).toContain("Type YES or NO");
    expect((await store.get("bob"))?.state.health).toBe(64);
    const strike = await handleMultiplayerCommand(store, room, "alice", (await store.get("alice"))!, "yes", 1_000);
    expect(strike?.messages[0].text).toContain("strike Bob");
    expect((await store.get("alice"))?.state.pvpEnabled).toBe(true);
    expect((await store.get("bob"))?.state.pvpEnabled).toBe(true);
    expect((await store.get("bob"))!.state.health).toBeLessThan(64);
    const reply = await handleMultiplayerCommand(store, room, "bob", (await store.get("bob"))!, "attack Alice", 1_000);
    expect(reply?.messages[0].text).toContain("strike Alice");
  });

  it("allows aid and targeted healing of a helpless player", async () => {
    const { store, room } = await setup();
    const now = Date.now();
    const bob = (await store.get("bob"))!;
    await store.commit("bob", bob.version, { ...bob.state, health: -3, lifeState: "dying", conditionAt: now });
    const aid = await handleMultiplayerCommand(store, room, "alice", (await store.get("alice"))!, "aid Bob", now);
    expect(aid?.messages[0].text).toContain("aid Bob");
    expect((await store.get("bob"))?.state.receivingAid).toBe(true);
    const alice = (await store.get("alice"))!;
    await store.commit("alice", alice.version, grantItems(alice.state, ["healing-draught"]));
    const healed = await handleMultiplayerCommand(store, room, "alice", (await store.get("alice"))!,
      "use healing draught on Bob", now);
    expect(healed?.messages[0].text).toContain("heal Bob");
    expect((await store.get("bob"))?.state.lifeState).toBe("alive");
    expect((await store.get("alice"))?.state.inventory.map((entry) => entry.itemId)).not.toContain("healing-draught");
  });
});
