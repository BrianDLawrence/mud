export type RoomCommand =
  | { kind: "who" }
  | { kind: "say"; content: string }
  | { kind: "emote"; content: string }
  | { kind: "error"; message: string };

const MAX_SOCIAL_LENGTH = 280;

function socialContent(argument: string, emptyMessage: string): RoomCommand | string {
  const content = argument.trim().replace(/\s+/g, " ");
  if (!content) return { kind: "error", message: emptyMessage };
  if (content.length > MAX_SOCIAL_LENGTH) {
    return {
      kind: "error",
      message: `Messages may not exceed ${MAX_SOCIAL_LENGTH} characters.`,
    };
  }
  if (/\p{Cc}/u.test(content)) {
    return { kind: "error", message: "Messages cannot contain control characters." };
  }
  return content;
}

export function parseRoomCommand(rawCommand: string): RoomCommand | null {
  const command = rawCommand.trim();
  const [verbToken = "", ...argumentTokens] = command.split(/\s+/);
  const verb = verbToken.toLocaleLowerCase("en-US");
  const argument = argumentTokens.join(" ");

  if (verb === "who") return { kind: "who" };

  if (verb === "say") {
    const content = socialContent(argument, "Say what?");
    return typeof content === "string" ? { kind: "say", content } : content;
  }

  if (verb === "emote" || verb === "em") {
    const content = socialContent(argument, "Emote what?");
    return typeof content === "string" ? { kind: "emote", content } : content;
  }

  return null;
}
