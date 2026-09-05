"use client";

import {
  DiscordSDK,
  Events,
  RPCCloseCodes,
  type EventPayloadData,
} from "@discord/embedded-app-sdk";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GameTerminal } from "@/components/game-terminal";
import { authClient } from "@/lib/auth-client";
import { disciplines } from "@/lib/game/disciplines";
import type { CharacterProfile, DisciplineId } from "@/lib/game/types";

type CharacterLoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; character: CharacterProfile }
  | { status: "error"; message: string };

type ActivityLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      accountName: string;
      sessionToken: string;
      participantCount: number;
    };

interface ActivitySessionResponse {
  accessToken?: string;
  sessionToken?: string;
  player?: { displayName: string };
  error?: string;
}

function TerminalFrame({
  children,
  footer = "FIRST LIGHT / IDENTITY GATE",
  connectionState = "IDENTITY REQUIRED",
}: Readonly<{
  children: React.ReactNode;
  footer?: string;
  connectionState?: string;
}>) {
  return (
    <main className="terminal-shell onboarding-shell">
      <header className="status-bar" aria-label="Connection status">
        <span>NEXTMUD</span>
        <span className="connection-state">{connectionState}</span>
      </header>
      <section className="transcript onboarding-transcript">{children}</section>
      <footer className="terminal-footer">{footer}</footer>
    </main>
  );
}

function LoadingGate({ message }: Readonly<{ message: string }>) {
  return (
    <TerminalFrame connectionState="CONNECTING">
      <p className="message tone-system">NEXTMUD // DEVELOPMENT REALM</p>
      <p className="message tone-narrative">{message}</p>
      <p className="message tone-status" aria-live="polite">
        Please wait...
      </p>
    </TerminalFrame>
  );
}

function SignInGate({ error }: Readonly<{ error?: string }>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [working, setWorking] = useState(false);
  const [signInError, setSignInError] = useState<string | undefined>(error);

  useEffect(() => {
    if (!working) buttonRef.current?.focus({ preventScroll: true });
  }, [working]);

  async function signIn() {
    setWorking(true);
    setSignInError(undefined);
    const result = await authClient.signIn.social({
      provider: "discord",
      callbackURL: "/",
    });

    if (result.error) {
      setWorking(false);
      setSignInError(result.error.message || "Discord sign-in failed.");
    }
  }

  return (
    <TerminalFrame>
      <p className="message tone-system">NEXTMUD // IDENTITY GATE</p>
      <p className="message tone-location">
        A name must stand behind every legend.
      </p>
      <p className="message tone-narrative">
        Connect a Discord identity to enter the realm. Your Discord name remains
        separate from the character name you choose next.
      </p>
      {signInError ? <p className="message tone-error">{signInError}</p> : null}
      <button
        ref={buttonRef}
        className="terminal-action"
        type="button"
        onClick={() => void signIn()}
        disabled={working}
      >
        &gt; {working ? "CONTACTING DISCORD..." : "SIGN IN WITH DISCORD"}
      </button>
      <p className="message tone-system">Press ENTER to continue.</p>
    </TerminalFrame>
  );
}

function ConnectionErrorGate({
  message,
  activity = false,
}: Readonly<{ message: string; activity?: boolean }>) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <TerminalFrame
      footer={activity ? "FIRST LIGHT / DISCORD ACTIVITY" : "FIRST LIGHT / CONNECTION"}
      connectionState="DISCONNECTED"
    >
      <p className="message tone-system">
        {`${activity ? "DISCORD ACTIVITY" : "NEXTMUD"} // CONNECTION FAILED`}
      </p>
      <p className="message tone-error">{message}</p>
      <button
        ref={buttonRef}
        className="terminal-action"
        type="button"
        onClick={() => window.location.reload()}
      >
        &gt; RETRY CONNECTION
      </button>
      <p className="message tone-system">Press ENTER to retry.</p>
    </TerminalFrame>
  );
}

function CharacterCreation({
  accountName,
  authToken,
  onCreated,
}: Readonly<{
  accountName: string;
  authToken?: string;
  onCreated: (character: CharacterProfile) => void;
}>) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [working]);

  async function createCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || !name.trim()) return;

    setWorking(true);
    setError(undefined);
    try {
      const response = await fetch("/api/character", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json()) as {
        character?: CharacterProfile;
        error?: string;
      };

      if (!response.ok || !payload.character) {
        throw new Error(payload.error || "Character creation failed.");
      }

      onCreated(payload.character);
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : "Character creation failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <TerminalFrame footer="FIRST LIGHT / CHARACTER CREATION">
      <p className="message tone-system">IDENTITY CONFIRMED // {accountName}</p>
      <p className="message tone-location">Who will you become?</p>
      <p className="message tone-narrative">
        Choose a unique character name containing 3–20 letters. Apostrophes and
        hyphens are permitted. Names cannot be changed during the alpha.
      </p>
      {error ? (
        <p className="message tone-error" aria-live="polite">
          {error}
        </p>
      ) : null}
      <form className="creation-command" onSubmit={createCharacter}>
        <label htmlFor="character-name">CHARACTER NAME &gt;</label>
        <input
          id="character-name"
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z][A-Za-z'-]*"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          disabled={working}
          autoFocus
        />
      </form>
      <p className="message tone-system">
        {working
          ? "Writing your name into the realm..."
          : "Press ENTER to claim this name."}
      </p>
    </TerminalFrame>
  );
}

function DisciplineSelection({
  character,
  authToken,
  onChosen,
}: Readonly<{
  character: CharacterProfile;
  authToken?: string;
  onChosen: (character: CharacterProfile) => void;
}>) {
  const [choice, setChoice] = useState("");
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!working) inputRef.current?.focus({ preventScroll: true });
  }, [working]);

  async function choose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;

    const discipline = choice.trim().toLocaleLowerCase() as DisciplineId;
    if (!(discipline in disciplines)) {
      setError("Type Vanguard, Wayfinder, or Arcanist.");
      return;
    }

    setWorking(true);
    setError(undefined);
    try {
      const response = await fetch("/api/character", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ discipline }),
      });
      const payload = (await response.json()) as {
        character?: CharacterProfile;
        error?: string;
      };
      if (!response.ok || !payload.character) {
        throw new Error(payload.error || "Discipline selection failed.");
      }
      onChosen(payload.character);
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Discipline selection failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <TerminalFrame footer="FIRST LIGHT / THE THREE PATHS">
      <p className="message tone-system">CHARACTER CONFIRMED // {character.name.toLocaleUpperCase()}</p>
      <p className="message tone-location">Choose your discipline.</p>
      <p className="message tone-narrative">
        This choice is permanent during the alpha. Each path can complete the
        First Adventure, but each fights differently.
      </p>
      {Object.values(disciplines).map((discipline) => (
        <p className="message discipline-option" key={discipline.id}>
          <span className="tone-status">{discipline.name.toLocaleUpperCase()}</span>
          {` — ${discipline.identity} HP ${discipline.maxHealth}${discipline.maxMana > 0 ? ` / MP ${discipline.maxMana}` : ""}. ${discipline.ability}`}
        </p>
      ))}
      {error ? (
        <p className="message tone-error" aria-live="polite">{error}</p>
      ) : null}
      <form className="creation-command" onSubmit={choose}>
        <label htmlFor="discipline-choice">DISCIPLINE &gt;</label>
        <input
          id="discipline-choice"
          ref={inputRef}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={working}
          autoFocus
        />
      </form>
      <p className="message tone-system">
        {working ? "Binding your path..." : "Type a discipline and press ENTER."}
      </p>
    </TerminalFrame>
  );
}

function AuthenticatedGame({
  accountName,
  authToken,
  connectionLabel,
  footer,
  onSignOut,
}: Readonly<{
  accountName: string;
  authToken?: string;
  connectionLabel?: string;
  footer?: string;
  onSignOut: () => Promise<void>;
}>) {
  const [characterState, setCharacterState] = useState<CharacterLoadState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/character", {
      signal: controller.signal,
      headers: authToken ? { authorization: `Bearer ${authToken}` } : undefined,
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          character?: CharacterProfile | null;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Character lookup failed.");
        }
        setCharacterState(
          payload.character
            ? { status: "ready", character: payload.character }
            : { status: "missing" },
        );
      })
      .catch((lookupError: unknown) => {
        if (
          lookupError instanceof DOMException &&
          lookupError.name === "AbortError"
        ) {
          return;
        }
        setCharacterState({
          status: "error",
          message:
            lookupError instanceof Error
              ? lookupError.message
              : "Character lookup failed.",
        });
      });

    return () => controller.abort();
  }, [authToken]);

  if (characterState.status === "loading") {
    return <LoadingGate message="Searching the rolls for your character." />;
  }

  if (characterState.status === "error") {
    return (
      <ConnectionErrorGate
        message={characterState.message}
        activity={Boolean(authToken)}
      />
    );
  }

  if (characterState.status === "missing") {
    return (
      <CharacterCreation
        accountName={accountName}
        authToken={authToken}
        onCreated={(character) =>
          setCharacterState({ status: "ready", character })
        }
      />
    );
  }

  if (!characterState.character.discipline) {
    return (
      <DisciplineSelection
        character={characterState.character}
        authToken={authToken}
        onChosen={(character) =>
          setCharacterState({ status: "ready", character })
        }
      />
    );
  }

  return (
    <GameTerminal
      characterProfile={characterState.character}
      authToken={authToken}
      connectionLabel={connectionLabel}
      footer={footer}
      onSignOut={onSignOut}
    />
  );
}

function WebGameApp() {
  const {
    data: session,
    isPending,
    error: sessionError,
  } = authClient.useSession();

  if (isPending) return <LoadingGate message="Checking your identity." />;
  if (!session) return <SignInGate error={sessionError?.message} />;

  return (
    <AuthenticatedGame
      accountName={session.user.name || session.user.email}
      onSignOut={async () => {
        await authClient.signOut();
        window.location.reload();
      }}
    />
  );
}

function DiscordActivityGameApp() {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const [activityState, setActivityState] = useState<ActivityLoadState>(() =>
    clientId
      ? { status: "loading" }
      : {
          status: "error",
          message:
            "NEXT_PUBLIC_DISCORD_CLIENT_ID is missing from this deployment.",
        },
  );
  const sdkRef = useRef<DiscordSDK | null>(null);

  useEffect(() => {
    if (!clientId) return;
    const activityClientId = clientId;

    let cancelled = false;
    let participantListener:
      | ((
          event: EventPayloadData<"ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE">,
        ) => void)
      | undefined;
    const sdk = new DiscordSDK(activityClientId);
    sdkRef.current = sdk;

    async function connect() {
      await sdk.ready();
      const { code } = await sdk.commands.authorize({
        client_id: activityClientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify"],
      });

      const response = await fetch("/api/activity/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, instanceId: sdk.instanceId }),
      });
      const payload = (await response.json()) as ActivitySessionResponse;
      if (
        !response.ok ||
        !payload.accessToken ||
        !payload.sessionToken ||
        !payload.player
      ) {
        throw new Error(payload.error || "Discord Activity sign-in failed.");
      }

      await sdk.commands.authenticate({ access_token: payload.accessToken });
      const connected = await sdk.commands.getInstanceConnectedParticipants();
      if (cancelled) return;

      setActivityState({
        status: "ready",
        accountName: payload.player.displayName,
        sessionToken: payload.sessionToken,
        participantCount: connected.participants.length,
      });

      participantListener = (event) => {
        if (cancelled) return;
        setActivityState((current) =>
          current.status === "ready"
            ? { ...current, participantCount: event.participants.length }
            : current,
        );
      };
      await sdk.subscribe(
        Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
        participantListener,
      );
    }

    void connect().catch((error: unknown) => {
      if (cancelled) return;
      setActivityState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Discord Activity sign-in failed.",
      });
    });

    return () => {
      cancelled = true;
      if (participantListener) {
        void sdk.unsubscribe(
          Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,
          participantListener,
        );
      }
    };
  }, [clientId]);

  if (activityState.status === "loading") {
    return <LoadingGate message="Opening a path through Discord." />;
  }
  if (activityState.status === "error") {
    return <ConnectionErrorGate message={activityState.message} activity />;
  }

  const partyLabel = `DISCORD PARTY ${activityState.participantCount}`;
  return (
    <AuthenticatedGame
      accountName={activityState.accountName}
      authToken={activityState.sessionToken}
      connectionLabel={partyLabel}
      footer={`FIRST LIGHT / ${partyLabel}`}
      onSignOut={async () => {
        sdkRef.current?.close(RPCCloseCodes.CLOSE_NORMAL, "Player exited NextMUD");
      }}
    />
  );
}

function isDiscordActivity(): boolean {
  const params = new URLSearchParams(window.location.search);
  return (
    window.location.hostname.endsWith(".discordsays.com") ||
    params.has("frame_id") ||
    params.has("instance_id")
  );
}

function subscribeToBrowserState() {
  return () => undefined;
}

export function GameApp() {
  const hydrated = useSyncExternalStore(
    subscribeToBrowserState,
    () => true,
    () => false,
  );

  if (!hydrated) {
    return <LoadingGate message="Detecting the gateway." />;
  }

  return isDiscordActivity() ? <DiscordActivityGameApp /> : <WebGameApp />;
}
