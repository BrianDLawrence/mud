import { z } from "zod";

const reservedCharacterNames = new Set([
  "admin",
  "administrator",
  "game",
  "gamemaster",
  "gm",
  "moderator",
  "narrator",
  "nextmud",
  "root",
  "system",
]);

export const characterNameSchema = z
  .string()
  .trim()
  .min(3, "Character names must contain at least 3 characters.")
  .max(20, "Character names cannot exceed 20 characters.")
  .regex(
    /^[A-Za-z][A-Za-z'-]*$/,
    "Use letters, apostrophes, or hyphens, beginning with a letter.",
  )
  .refine(
    (name) => !reservedCharacterNames.has(normalizeCharacterName(name)),
    "That character name is reserved.",
  );

export function normalizeCharacterName(name: string): string {
  return name.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}
