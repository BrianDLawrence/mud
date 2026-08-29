import { ObjectId, type Collection } from "mongodb";
import type {
  MessageTone,
  RoomEventType,
  RoomEventView,
} from "@/lib/game/types";
import { getMongoClient } from "@/lib/mongodb";

const PRESENCE_LIFETIME_MS = 45_000;
const EVENT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;

interface PresenceRecord {
  _id: string;
  characterName: string;
  roomId: string;
  lastSeenAt: Date;
  expiresAt: Date;
}

interface RoomEventDocument {
  _id: ObjectId;
  roomId: string;
  type: RoomEventType;
  actorId: string;
  actorName: string;
  tone: MessageTone;
  text: string;
  occurredAt: Date;
  expiresAt: Date;
}

interface RateLimitDocument {
  _id: string;
  count: number;
  expiresAt: Date;
}

export interface PresenceChange {
  kind: "joined" | "moved" | "stayed";
  previousRoomId?: string;
}

export interface RoomEventInput {
  roomId: string;
  type: RoomEventType;
  actorId: string;
  actorName: string;
  tone: MessageTone;
  text: string;
}

export interface RoomEventFeed {
  cursor: string | null;
  events: RoomEventView[];
}

export interface RoomStore {
  setPresence(
    characterId: string,
    characterName: string,
    roomId: string,
  ): Promise<PresenceChange>;
  removePresence(characterId: string): Promise<PresenceRecord | null>;
  listPresent(roomId: string): Promise<string[]>;
  appendEvent(event: RoomEventInput): Promise<string>;
  latestCursor(roomId: string): Promise<string | null>;
  readEvents(
    roomId: string,
    after: string,
    viewerId: string,
  ): Promise<RoomEventFeed>;
  checkRateLimit(
    actorId: string,
    scope: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean>;
}

function toEventView(event: RoomEventDocument): RoomEventView {
  return {
    id: event._id.toHexString(),
    type: event.type,
    tone: event.tone,
    text: event.text,
    occurredAt: event.occurredAt.toISOString(),
  };
}

class MongoRoomStore implements RoomStore {
  private indexesReady?: Promise<void>;

  private get database() {
    return getMongoClient().db(process.env.MONGODB_DATABASE || "nextmud");
  }

  private get presence(): Collection<PresenceRecord> {
    return this.database.collection<PresenceRecord>("room_presence");
  }

  private get events(): Collection<RoomEventDocument> {
    return this.database.collection<RoomEventDocument>("game_events");
  }

  private get rateLimits(): Collection<RateLimitDocument> {
    return this.database.collection<RateLimitDocument>("rate_limits");
  }

  private ensureIndexes(): Promise<void> {
    this.indexesReady ??= Promise.all([
      this.presence.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.presence.createIndex({ roomId: 1, expiresAt: 1 }),
      this.events.createIndex({ roomId: 1, _id: 1 }),
      this.events.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).then(() => undefined);
    return this.indexesReady;
  }

  async setPresence(
    characterId: string,
    characterName: string,
    roomId: string,
  ): Promise<PresenceChange> {
    await this.ensureIndexes();
    const now = new Date();
    const previous = await this.presence.findOneAndUpdate(
      { _id: characterId },
      {
        $set: {
          characterName,
          roomId,
          lastSeenAt: now,
          expiresAt: new Date(now.getTime() + PRESENCE_LIFETIME_MS),
        },
      },
      { upsert: true, returnDocument: "before" },
    );
    const wasActive = Boolean(previous && previous.expiresAt > now);

    if (!wasActive) return { kind: "joined" };
    if (previous!.roomId !== roomId) {
      return { kind: "moved", previousRoomId: previous!.roomId };
    }
    return { kind: "stayed" };
  }

  async removePresence(characterId: string): Promise<PresenceRecord | null> {
    await this.ensureIndexes();
    const existing = await this.presence.findOneAndDelete({ _id: characterId });
    if (!existing) return null;
    return existing.expiresAt > new Date() ? existing : null;
  }

  async listPresent(roomId: string): Promise<string[]> {
    await this.ensureIndexes();
    const records = await this.presence
      .find({ roomId, expiresAt: { $gt: new Date() } })
      .sort({ characterName: 1 })
      .toArray();
    return records.map((record) => record.characterName);
  }

  async appendEvent(input: RoomEventInput): Promise<string> {
    await this.ensureIndexes();
    const occurredAt = new Date();
    const event: RoomEventDocument = {
      _id: new ObjectId(),
      ...input,
      occurredAt,
      expiresAt: new Date(occurredAt.getTime() + EVENT_LIFETIME_MS),
    };
    await this.events.insertOne(event);
    return event._id.toHexString();
  }

  async latestCursor(roomId: string): Promise<string | null> {
    await this.ensureIndexes();
    const event = await this.events.findOne(
      { roomId },
      { sort: { _id: -1 }, projection: { _id: 1 } },
    );
    return event?._id.toHexString() || null;
  }

  async readEvents(
    roomId: string,
    after: string,
    viewerId: string,
  ): Promise<RoomEventFeed> {
    await this.ensureIndexes();
    const afterId = new ObjectId(after);
    const events = await this.events
      .find({ roomId, _id: { $gt: afterId } })
      .sort({ _id: 1 })
      .limit(100)
      .toArray();

    return {
      cursor: events.at(-1)?._id.toHexString() || after,
      events: events
        .filter((event) => event.actorId !== viewerId)
        .map(toEventView),
    };
  }

  async checkRateLimit(
    actorId: string,
    scope: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    await this.ensureIndexes();
    const now = Date.now();
    const window = Math.floor(now / (windowSeconds * 1_000));
    const id = `${scope}:${actorId}:${window}`;
    const result = await this.rateLimits.findOneAndUpdate(
      { _id: id },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(now + windowSeconds * 2_000) },
      },
      { upsert: true, returnDocument: "after" },
    );
    return Boolean(result && result.count <= limit);
  }
}

interface MemoryRoomEvent extends Omit<RoomEventDocument, "_id"> {
  _id: number;
}

export class MemoryRoomStore implements RoomStore {
  private readonly presence = new Map<string, PresenceRecord>();
  private readonly events: MemoryRoomEvent[] = [];
  private readonly rateLimits = new Map<string, { count: number; expiresAt: number }>();
  private cursor = 0;

  async setPresence(
    characterId: string,
    characterName: string,
    roomId: string,
  ): Promise<PresenceChange> {
    const now = new Date();
    const previous = this.presence.get(characterId);
    const wasActive = Boolean(previous && previous.expiresAt > now);
    this.presence.set(characterId, {
      _id: characterId,
      characterName,
      roomId,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + PRESENCE_LIFETIME_MS),
    });
    if (!wasActive) return { kind: "joined" };
    if (previous!.roomId !== roomId) {
      return { kind: "moved", previousRoomId: previous!.roomId };
    }
    return { kind: "stayed" };
  }

  async removePresence(characterId: string): Promise<PresenceRecord | null> {
    const existing = this.presence.get(characterId);
    this.presence.delete(characterId);
    return existing && existing.expiresAt > new Date() ? existing : null;
  }

  async listPresent(roomId: string): Promise<string[]> {
    const now = new Date();
    return [...this.presence.values()]
      .filter((record) => record.roomId === roomId && record.expiresAt > now)
      .map((record) => record.characterName)
      .sort((left, right) => left.localeCompare(right));
  }

  async appendEvent(input: RoomEventInput): Promise<string> {
    const occurredAt = new Date();
    this.cursor += 1;
    this.events.push({
      _id: this.cursor,
      ...input,
      occurredAt,
      expiresAt: new Date(occurredAt.getTime() + EVENT_LIFETIME_MS),
    });
    return String(this.cursor);
  }

  async latestCursor(roomId: string): Promise<string | null> {
    const event = this.events.findLast((candidate) => candidate.roomId === roomId);
    return event ? String(event._id) : null;
  }

  async readEvents(
    roomId: string,
    after: string,
    viewerId: string,
  ): Promise<RoomEventFeed> {
    const cursor = Number.parseInt(after, 10);
    const events = this.events
      .filter((event) => event.roomId === roomId && event._id > cursor)
      .slice(0, 100);
    return {
      cursor: events.length > 0 ? String(events.at(-1)!._id) : after,
      events: events
        .filter((event) => event.actorId !== viewerId)
        .map((event) => ({
          id: String(event._id),
          type: event.type,
          tone: event.tone,
          text: event.text,
          occurredAt: event.occurredAt.toISOString(),
        })),
    };
  }

  async checkRateLimit(
    actorId: string,
    scope: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const now = Date.now();
    const id = `${scope}:${actorId}:${Math.floor(now / (windowSeconds * 1_000))}`;
    const current = this.rateLimits.get(id);
    const next = current && current.expiresAt > now ? current.count + 1 : 1;
    this.rateLimits.set(id, { count: next, expiresAt: now + windowSeconds * 2_000 });
    return next <= limit;
  }
}

const globalRoomStores = globalThis as typeof globalThis & {
  nextMudRoomStore?: RoomStore;
};

export function getRoomStore(): RoomStore {
  if (!globalRoomStores.nextMudRoomStore) {
    if (process.env.MONGODB_URI) {
      globalRoomStores.nextMudRoomStore = new MongoRoomStore();
    } else if (process.env.VERCEL_ENV === "production") {
      throw new Error("MONGODB_URI must be configured for production.");
    } else {
      globalRoomStores.nextMudRoomStore = new MemoryRoomStore();
    }
  }
  return globalRoomStores.nextMudRoomStore;
}
