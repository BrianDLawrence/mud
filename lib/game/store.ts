import type { Collection } from "mongodb";
import { createInitialCharacterState } from "@/lib/game/engine";
import type { CharacterState, StoredCharacter } from "@/lib/game/types";
import { getMongoClient } from "@/lib/mongodb";

export interface GameStore {
  getOrCreate(characterId: string): Promise<StoredCharacter>;
  commit(
    characterId: string,
    expectedVersion: number,
    nextState: CharacterState,
  ): Promise<boolean>;
}

function cloneStoredCharacter(character: StoredCharacter): StoredCharacter {
  return structuredClone(character);
}

class MemoryGameStore implements GameStore {
  private readonly characters = new Map<string, StoredCharacter>();

  async getOrCreate(characterId: string): Promise<StoredCharacter> {
    const existing = this.characters.get(characterId);
    if (existing) return cloneStoredCharacter(existing);

    const created = { state: createInitialCharacterState(), version: 0 };
    this.characters.set(characterId, created);
    return cloneStoredCharacter(created);
  }

  async commit(
    characterId: string,
    expectedVersion: number,
    nextState: CharacterState,
  ): Promise<boolean> {
    const existing = this.characters.get(characterId);
    if (!existing || existing.version !== expectedVersion) return false;

    this.characters.set(characterId, {
      state: structuredClone(nextState),
      version: expectedVersion + 1,
    });
    return true;
  }
}

interface CharacterDocument {
  _id: string;
  state: CharacterState;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

class MongoGameStore implements GameStore {
  private get collection(): Collection<CharacterDocument> {
    const databaseName = process.env.MONGODB_DATABASE || "nextmud";
    return getMongoClient().db(databaseName).collection("characters");
  }

  async getOrCreate(characterId: string): Promise<StoredCharacter> {
    const now = new Date();
    await this.collection.updateOne(
      { _id: characterId },
      {
        $setOnInsert: {
          state: createInitialCharacterState(),
          version: 0,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    const character = await this.collection.findOne({ _id: characterId });
    if (!character) throw new Error("Character could not be loaded.");

    return { state: character.state, version: character.version };
  }

  async commit(
    characterId: string,
    expectedVersion: number,
    nextState: CharacterState,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: characterId, version: expectedVersion },
      {
        $set: { state: nextState, updatedAt: new Date() },
        $inc: { version: 1 },
      },
    );

    return result.modifiedCount === 1;
  }
}

const globalStores = globalThis as typeof globalThis & {
  nextMudMemoryStore?: MemoryGameStore;
  nextMudMongoStore?: MongoGameStore;
};

export function getGameStore(): GameStore {
  if (process.env.MONGODB_URI) {
    globalStores.nextMudMongoStore ??= new MongoGameStore();
    return globalStores.nextMudMongoStore;
  }

  if (process.env.VERCEL_ENV === "production") {
    throw new Error("MONGODB_URI must be configured for production.");
  }

  globalStores.nextMudMemoryStore ??= new MemoryGameStore();
  return globalStores.nextMudMemoryStore;
}
