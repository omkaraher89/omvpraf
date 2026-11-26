# ChartFlow — TradingView Pro terminal

Real-time futures/chart terminal (React + Vite) running on a single Cloudflare Worker
with a D1 database. Everything Firebase used to do — accounts, sessions and the user's
workspace (chart settings, indicators, layouts, drawings, templates, alerts, positions) —
is handled by the Worker + D1 in this repo.

## What runs where

| Part | Tech |
| --- | --- |
| UI | React 19 + Vite (`src/`), built to `dist/` |
| API | Cloudflare Worker (`worker/index.ts`) |
| Accounts | Email + password, PBKDF2-SHA256 hashing, HttpOnly session cookies (`worker/auth.ts`) |
| Database | Cloudflare D1 (`sql/schema.sql`) — `users`, `sessions`, `workspaces` |
| Market data | LSE REST API, server-side only (`LSE_API_KEY`) |

## Deploy to your Cloudflare account

```sh
# 1. install
bun install

# 2. create the database and copy the printed database_id into wrangler.jsonc
npx wrangler d1 create chartflow

# 3. create the tables (remote database)
npx wrangler d1 execute chartflow --remote --file=./sql/schema.sql

# 4. the only secret this app needs
npx wrangler secret put LSE_API_KEY

# 5. build the UI + Worker bundle and deploy
bun run deploy
```

`bun run deploy` = `vite build` → `esbuild` bundle of `worker/index.ts` →
`wrangler deploy`. The Worker serves `/api/*` and the built SPA; `wrangler.jsonc`
declares the D1 binding as `DB` and the assets binding as `ASSETS`.

### Secrets / variables

| Name | Type | Required | What it is |
| --- | --- | --- | --- |
| `LSE_API_KEY` | Secret | yes | London Strategic Edge market-data API key. Server-side only; the browser never sees it. |

Nothing else is needed — there is no OAuth client, no Firebase config, no session
signing key. Account passwords are hashed in the Worker and sessions are random
opaque tokens stored in D1.

Set the secret from the dashboard instead if you prefer:
**Workers & Pages → chartflow-terminal → Settings → Variables and Secrets →
Add → type “Secret” → name `LSE_API_KEY`**.

> Password hashing is tuned for the Workers **Free** plan: `PBKDF2_ITERATIONS`
> in `worker/auth.ts` is 20 000, which keeps sign-up/sign-in around 4–6 ms of CPU
> inside the Free plan's 10 ms budget, and `wrangler.jsonc` deliberately sets no
> `limits.cpu_ms` (Cloudflare rejects that on Free with error 100328).
> On the Workers Paid plan you can raise `PBKDF2_ITERATIONS` back to 100 000 and
> add `"limits": { "cpu_ms": 50 }` to `wrangler.jsonc` for stronger hashing.


## Deploy with Cloudflare Pages (Git-connected)

This repo also ships a Pages Functions adapter (`functions/api/[[path]].ts`) that
reuses the exact same API as the Worker, so auth and the workspace API work on Pages too.

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo.
2. Build command: `bun run build` · Build output directory: `dist` · Root directory: `/`
3. After the first build: Pages project → **Settings → Functions → Bindings**
   - D1 database binding: variable name **`DB`** → your `chartflow` database
   - Secret: **`LSE_API_KEY`** → your LSE key
4. Settings → Runtime → Compatibility date `2026-11-23`.
5. Retry the deployment so the bindings are live.

Create the tables once (Pages uses the same database as the Worker):

```sh
npx wrangler d1 execute chartflow --remote --file=./sql/schema.sql
```

Or from the CLI instead of the dashboard:

```sh
bun run pages:deploy      # builds and runs `wrangler pages deploy dist`
bun run pages:dev         # local Pages + Functions + local D1
```

`public/_routes.json` limits Functions to `/api/*`, so all static assets are served by
Pages directly and everything else falls through to `index.html`.

## Local development

```sh
bun run dev        # builds the SPA + Worker and runs `wrangler dev` with a local D1
```

Open http://localhost:8787, create an account, and the data is stored in the local
D1 (`.wrangler/state`). The schema is created automatically on first request.

`bun run dev:node` still runs the original Express server (`server.ts`) for the market
feed work, but it does not implement accounts/D1 — use `bun run dev` for anything auth
related.

## API surface

| Route | Purpose |
| --- | --- |
| `POST /api/auth/signup` | Create an account (`email`, `password`, optional `name`), starts a session |
| `POST /api/auth/login` | Sign in |
| `POST /api/auth/logout` | Clear the session |
| `GET /api/auth/session` | Current user (`{ user: null }` when signed out) |
| `GET /api/workspace` | The signed-in account's workspace snapshot (401 otherwise) |
| `PUT /api/workspace` | Save the snapshot (401 signed out, 403 cross-origin) |
| `/api/market/*`, `/api/lse/*` | Market data proxies (need `LSE_API_KEY`) |

Security notes: workspace rows are keyed by the session's `user.id` (never by an id
from the request body), every state-changing route checks same-origin, workspace
responses are `Cache-Control: private, no-store`, and session cookies are `HttpOnly;
SameSite=Lax` (+ `Secure` on https).
