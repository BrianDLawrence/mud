"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  CharacterProfile,
  CharacterSummary,
  GameMessage,
  RoomEventView,
} from "@/lib/game/types";

export function GameTerminal({
  characterProfile,
  authToken,
  connectionLabel = "CONNECTED",
  footer = "FIRST LIGHT / LOCAL DEVELOPMENT REALM",
  onSignOut,
}: Readonly<{
  characterProfile: CharacterProfile;
  authToken?: string;
  connectionLabel?: string;
  footer?: string;
  onSignOut: () => Promise<void>;
}>) {
  const [messages, setMessages] = useState<GameMessage[]>(() => [
    { tone: "system", text: "NEXTMUD // DEVELOPMENT REALM" },
    { tone: "narrative", text: `Welcome, ${characterProfile.name}. The realm remembers you.` },
    { tone: "system", text: "Type HELP for commands. Type CLEAR to clear this terminal." },
  ]);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [character, setCharacter] = useState<CharacterSummary>(
    characterProfile.summary,
  );
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const roomCursorRef = useRef<string | null>(null);
  const pollingRef = useRef(false);
  const roomErrorShownRef = useRef(false);

  const roomHeaders = useCallback(
    () => (authToken ? { authorization: `Bearer ${authToken}` } : undefined),
    [authToken],
  );

  const departRoom = useCallback(() => {
    void fetch("/api/game/room", {
      method: "DELETE",
      headers: roomHeaders(),
      keepalive: true,
    }).catch(() => undefined);
  }, [roomHeaders]);

  const sendCommand = useCallback(async (value: string, echo = true) => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;

    if (trimmed.toLocaleLowerCase() === "clear") {
      setMessages([]);
      return;
    }

    if (["logout", "quit", "signout"].includes(trimmed.toLocaleLowerCase())) {
      setBusy(true);
      try {
        departRoom();
        await onSignOut();
      } finally {
        setBusy(false);
      }
      return;
    }

    if (echo) {
      setMessages((current) => [
        ...current,
        { tone: "system", text: `> ${trimmed}` },
      ]);
      setHistory((current) => [...current, trimmed]);
      setHistoryIndex(-1);
    }

    setBusy(true);
    try {
      const response = await fetch("/api/game/command", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ command: trimmed }),
      });
      const payload = (await response.json()) as {
        messages?: GameMessage[];
        character?: CharacterSummary;
        error?: string;
      };

      if (!response.ok || !payload.messages || !payload.character) {
        throw new Error(payload.error || "The command failed.");
      }

      setMessages((current) => [...current, ...payload.messages!]);
      setCharacter(payload.character);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          tone: "error",
          text: error instanceof Error ? error.message : "The command failed.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [authToken, busy, departRoom, onSignOut]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void sendCommand("look", false);
  }, [sendCommand]);

  useEffect(() => {
    let cancelled = false;

    async function heartbeat() {
      const response = await fetch("/api/game/room", {
        method: "POST",
        headers: roomHeaders(),
      });
      const payload = (await response.json()) as {
        cursor?: string | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Room presence failed.");
      }
      if (roomCursorRef.current === null && payload.cursor) {
        roomCursorRef.current = payload.cursor;
      }
    }

    async function pollEvents() {
      const cursor = roomCursorRef.current;
      if (!cursor || pollingRef.current || cancelled) return;

      pollingRef.current = true;
      try {
        const response = await fetch(
          `/api/game/room?after=${encodeURIComponent(cursor)}`,
          { headers: roomHeaders(), cache: "no-store" },
        );
        const payload = (await response.json()) as {
          cursor?: string | null;
          events?: RoomEventView[];
          error?: string;
        };
        if (!response.ok || !payload.events) {
          throw new Error(payload.error || "Room events failed.");
        }
        if (payload.cursor) roomCursorRef.current = payload.cursor;
        if (payload.events.length > 0) {
          setMessages((current) => [
            ...current,
            ...payload.events!.map(({ tone, text }) => ({ tone, text })),
          ]);
        }
        roomErrorShownRef.current = false;
      } catch (error) {
        if (!cancelled && !roomErrorShownRef.current) {
          roomErrorShownRef.current = true;
          setMessages((current) => [
            ...current,
            {
              tone: "error",
              text:
                error instanceof Error
                  ? error.message
                  : "Room events are temporarily unavailable.",
            },
          ]);
        }
      } finally {
        pollingRef.current = false;
      }
    }

    void heartbeat()
      .then(() => pollEvents())
      .catch((error: unknown) => {
        if (!cancelled && !roomErrorShownRef.current) {
          roomErrorShownRef.current = true;
          setMessages((current) => [
            ...current,
            {
              tone: "error",
              text:
                error instanceof Error
                  ? error.message
                  : "Room presence is temporarily unavailable.",
            },
          ]);
        }
      });

    const heartbeatInterval = window.setInterval(() => {
      void heartbeat().catch(() => undefined);
    }, 15_000);
    const pollingInterval = window.setInterval(() => {
      void pollEvents();
    }, 3_000);
    const handlePageHide = () => departRoom();
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatInterval);
      window.clearInterval(pollingInterval);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [departRoom, roomHeaders]);

  useLayoutEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!busy) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [busy]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy || !command.trim()) {
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    const nextCommand = command;
    setCommand("");
    void sendCommand(nextCommand);
  }

  function navigateHistory(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();

    if (event.key === "ArrowUp") {
      const nextIndex = Math.min(historyIndex + 1, history.length - 1);
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setCommand(history[history.length - 1 - nextIndex]);
      }
      return;
    }

    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setCommand(nextIndex < 0 ? "" : history[history.length - 1 - nextIndex]);
  }

  return (
    <main className="terminal-shell" onClick={() => inputRef.current?.focus()}>
      <header className="status-bar" aria-label="Character status">
        <span>NEXTMUD</span>
        <span>{characterProfile.name.toLocaleUpperCase()}</span>
        <span>LVL {character.level}</span>
        <span>HP {character.health}/{character.maxHealth}</span>
        {character.maxMana > 0 ? <span>MP {character.mana}/{character.maxMana}</span> : null}
        <span>XP {character.experience}</span>
        <span className="connection-state">
          {busy ? "WORKING" : connectionLabel}
        </span>
      </header>

      <section
        className="transcript"
        ref={transcriptRef}
        aria-live="polite"
        aria-label="Game transcript"
      >
        {messages.map((entry, index) => (
          <p className={`message tone-${entry.tone}`} key={`${index}-${entry.text}`}>
            {entry.text}
          </p>
        ))}
      </section>

      <form className="command-line" onSubmit={submit} aria-busy={busy}>
        <label className="sr-only" htmlFor="game-command">Enter a game command</label>
        <span
          className="prompt-status"
          aria-label={`Health ${character.health} of ${character.maxHealth}${character.maxMana > 0 ? `, mana ${character.mana} of ${character.maxMana}` : ""}`}
        >
          <span>HP {character.health}/{character.maxHealth}</span>
          {character.maxMana > 0 ? <span>MP {character.mana}/{character.maxMana}</span> : null}
          <span aria-hidden="true">&gt;</span>
        </span>
        <input
          id="game-command"
          ref={inputRef}
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={navigateHistory}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
        />
        <span className="cursor" aria-hidden="true" />
      </form>

      <footer className="terminal-footer">{footer}</footer>
    </main>
  );
}
