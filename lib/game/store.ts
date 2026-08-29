import { MongoServerError, type Collection } from "mongodb";
import { createInitialCharacterState } from "@/lib/game/engine";
import type { CharacterState, StoredCharacter } from "@/lib/game/types";
import { getMongoClient } from "@/lib/mongodb";

export type CreateCharacterResult =
  | { created: true; character: StoredCharacter }
  | { created: false; reason: "character_exists" | "name_taken" };

export interface GameStore {
  get(characterId: string): Promise<StoredCharacter | null>;
  create(
    characterId: string,
    name: string,
    normalizedName: string,
  ): Promise<CreateCharacterResult>;
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

  async get(characterId: string): Promise<StoredCharacter | null> {
    const existing = this.characters.get(characterId);
    return existing ? cloneStoredCharacter(existing) : null;
  }

  async create(
    characterId: string,
    name: string,
    normalizedName: string,
  ): Promise<CreateCharacterResult> {
    if (this.characters.has(characterId)) {
      return { created: false, reason: "character_exists" };
    }

    const nameTaken = [...this.characters.values()].some(
      (character) => character.name.toLocaleLowerCase("en-US") === normalizedName,
    );
    if (nameTaken) return { created: false, reason: "name_taken" };

    const created = { name, state: createInitialCharacterState(), version: 0 };
    this.characters.set(characterId, created);
    return { created: true, character: cloneStoredCharacter(created) };
  }

  async commit(
    characterId: string,
    expectedVersion: number,
    nextState: CharacterState,
  ): Promise<boolean> {
    const existing = this.characters.get(characterId);
    if (!existing || existing.version !== expectedVersion) return false;

    this.characters.set(characterId, {
      name: existing.name,
      state: structuredClone(nextState),
      version: expectedVersion + 1,
    });
    return true;
  }
}

interface CharacterDocument {
  _id: string;
  ownerId: string;
  name: string;
  normalizedName: string;
  state: CharacterState;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

class MongoGameStore implements GameStore {
  private indexesReady?: Promise<string>;

  private get collection(): Collection<CharacterDocument> {
    const databaseName = process.env.MONGODB_DATABASE || "nextmud";
    return getMongoClient().db(databaseName).collection("characters");
  }

  private ensureIndexes(): Promise<string> {
    this.indexesReady ??= this.collection.createIndex(
      { normalizedName: 1 },
      {
        unique: true,
        name: "unique_character_name",
        partialFilterExpression: { normalizedName: { $type: "string" } },
      },
    );
    return this.indexesReady;
  }

  async get(characterId: string): Promise<StoredCharacter | null> {
    const character = await this.collection.findOne({ _id: characterId });
    if (!character?.name) return null;

    return {
      name: character.name,
      state: character.state,
      version: character.version,
    };
  }

  async create(
    characterId: string,
    name: string,
    normalizedName: string,
  ): Promise<CreateCharacterResult> {
    await this.ensureIndexes();
    const now = new Date();
    const character: CharacterDocument = {
      _id: characterId,
      ownerId: characterId,
      name,
      normalizedName,
      state: createInitialCharacterState(),
      version: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.collection.insertOne(character);
      return {
        created: true,
        character: {
          name: character.name,
          state: character.state,
          version: character.version,
        },
      };
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        const keyPattern = error.errorResponse?.keyPattern as
          | Record<string, number>
          | undefined;
        return {
          created: false,
          reason: keyPattern?.normalizedName
            ? "name_taken"
            : "character_exists",
        };
      }
      throw error;
    }
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
