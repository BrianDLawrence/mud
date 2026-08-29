import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { getMongoClient } from "@/lib/mongodb";

const mongoClient = getMongoClient();
const database = mongoClient.db(process.env.MONGODB_DATABASE || "nextmud");
const developmentFallbackSecret =
  "nextmud-auth-is-not-configured-do-not-use-this-secret";

export function isAuthConfigured(): boolean {
  return [
    process.env.BETTER_AUTH_SECRET,
    process.env.BETTER_AUTH_URL,
    process.env.DISCORD_CLIENT_ID,
    process.env.DISCORD_CLIENT_SECRET,
  ].every(Boolean);
}

export const auth = betterAuth({
  appName: "NextMUD",
  database: mongodbAdapter(database, { client: mongoClient }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || developmentFallbackSecret,
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || "not-configured",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "not-configured",
    },
  },
  advanced: {
    database: {
      joins: true,
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
