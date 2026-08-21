import { MongoClient } from "mongodb";

const globalMongo = globalThis as typeof globalThis & {
  nextMudMongoClient?: MongoClient;
};

export function getMongoClient(): MongoClient {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is required for MongoDB persistence.");
  }

  if (!globalMongo.nextMudMongoClient) {
    globalMongo.nextMudMongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 30_000,
      serverSelectionTimeoutMS: 5_000,
    });
  }

  return globalMongo.nextMudMongoClient;
}
