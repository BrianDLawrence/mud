# Authentication and character identity

The alpha uses Better Auth with Discord OAuth and MongoDB. One authenticated account owns one uniquely named character.

Discord answers **who controls the account**. The character record answers **who exists in the world**. A player's Discord username is never used as their character name automatically.

## 1. Create a Discord OAuth application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select **New Application** and give it a recognizable development name.
3. Open **OAuth2** and copy the Client ID.
4. Reset and securely copy the Client Secret.
5. Add these redirect URLs:

```text
http://localhost:3000/api/auth/callback/discord
https://YOUR-PRODUCTION-DOMAIN/api/auth/callback/discord
```

The production URL must match the public Vercel domain exactly, including `https` and excluding a trailing slash before `/api`.

No Discord bot or bot permissions are required.

## 2. Configure local development

Copy `.env.example` to `.env.local` and provide:

```text
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=nextmud
BETTER_AUTH_SECRET=<at-least-32-high-entropy-characters>
BETTER_AUTH_URL=http://localhost:3000
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
NEXT_PUBLIC_DISCORD_CLIENT_ID=<same value as DISCORD_CLIENT_ID>
```

Generate the auth secret locally with:

```bash
openssl rand -base64 32
```

Never commit `.env.local` or paste its values into an issue.

## 3. Configure Vercel

In the Vercel project, open **Settings → Environment Variables** and add the same six variables. For production:

```text
BETTER_AUTH_URL=https://YOUR-PRODUCTION-DOMAIN
```

Apply them to **Production**. Apply them to **Preview** only if the corresponding preview callback URLs are also authorized in Discord. After saving variables, redeploy; existing deployments do not receive newly added environment variables.

Visit `/api/health` after deployment. It should report:

```json
{
  "status": "ok",
  "persistence": "mongodb",
  "authentication": "configured",
  "discordActivity": "configured"
}
```

## Runtime behavior

- Better Auth owns the `user`, `session`, `account`, and verification collections.
- Discord creates or restores the account and an HTTP-only session cookie.
- The character API requires a valid server-side session.
- Character names are 3–20 characters and globally unique without regard to case.
- The `characters.normalizedName` unique index is created on first character creation.
- Gameplay commands resolve both web OAuth and Discord Activity sessions to one stable Discord-derived player ID.
- `SIGNOUT`, `LOGOUT`, or `QUIT` ends the current session from the terminal.

## Existing development characters

Guest characters created before authentication do not contain account ownership or character names. They remain inert legacy documents and are ignored. They may be archived or removed after confirming no test data needs to be retained.

## Security notes

- OAuth client secrets and `BETTER_AUTH_SECRET` are server-only values.
- UI state is never accepted as proof of identity.
- Every character and gameplay endpoint validates the Better Auth session.
- MongoDB's unique index—not a client-side availability check—guarantees name uniqueness.
- Account deletion, session management, moderation, and recovery flows must be designed before a production launch.
