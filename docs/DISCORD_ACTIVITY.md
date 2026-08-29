# Discord Activity setup

NextMUD can run from the same Vercel deployment as a normal website and as an embedded Discord Activity. The Activity uses Discord's Embedded App SDK for authorization and a short-lived bearer session for game API calls. It does not depend on third-party cookies inside the Discord iframe.

## What is implemented

1. The client detects Discord's Activity proxy and initializes the Embedded App SDK.
2. Discord returns a one-time authorization code for the `identify` scope.
3. `/api/activity/session` exchanges that code with Discord on the server and verifies the user through `/users/@me`.
4. The server stores only a SHA-256 hash of the opaque NextMUD session token. MongoDB automatically expires it after at most one hour.
5. Web OAuth and Activity login derive the same internal player ID from the verified Discord user ID, so both entry paths load the same character.
6. The terminal displays the current Activity instance participant count. Shared rooms, party state, chat, and presence remain later gameplay milestones.

## Vercel environment

Add this public value in addition to the existing authentication variables:

```text
NEXT_PUBLIC_DISCORD_CLIENT_ID=<same value as DISCORD_CLIENT_ID>
```

`NEXT_PUBLIC_` means the Client ID is embedded in browser JavaScript. Discord Client IDs are public. Never expose `DISCORD_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, or `MONGODB_URI` this way.

Redeploy after adding the variable. The `/api/health` response should report `discordActivity` as `configured`.

## Discord Developer Portal

Use the same Discord application already configured for web OAuth:

1. Open **Installation** and enable both User Install and Guild Install if you want launches in servers, DMs, and group DMs.
2. Open **OAuth2 → Redirects**. Keep the existing Better Auth callback URLs. Discord also requires a redirect entry for Activities; `https://127.0.0.1` is sufficient because the Embedded App SDK handles the Activity redirect.
3. Open **Activities → URL Mappings** and map `/` to the production Vercel hostname without `https://` and without a path. Example: `nextmud.vercel.app`.
4. Open **Activities → Settings** and enable Activities. Discord creates the default Launch entry-point command.
5. Enable Developer Mode in your Discord client while the application is private/in development.
6. Launch the Activity from Discord's App Launcher in a test server, DM, or group DM.

The root mapping intentionally covers the page, `/_next` assets, and same-origin `/api` requests through Discord's proxy.

## Local Activity testing

Discord must reach the local Next.js server through HTTPS. Run NextMUD locally, expose port 3000 with a trusted tunnel such as Cloudflare Tunnel or ngrok, then temporarily point the `/` Activity mapping at the tunnel hostname. Restore the production Vercel hostname after testing.

A normal browser does not initialize the Embedded App SDK; it continues to use the Better Auth web flow. Activity behavior must be tested from inside Discord.

## Security and operational notes

- The browser-provided SDK user object is never accepted as identity proof.
- Discord OAuth codes are exchanged only on the server with the Client Secret.
- Activity bearer tokens are random, held only in memory by the client, stored hashed in MongoDB, and expire after at most one hour.
- MongoDB's TTL cleanup is asynchronous; authorization also checks `expiresAt`, so an expired token stops working even before its document is deleted.
- `instanceId` and participant data are context, not authorization. Future party and room APIs must still validate every player action server-side.
- Add rate limiting before public discovery or a large external test.
