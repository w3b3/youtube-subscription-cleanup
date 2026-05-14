# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (server + client HMR in one process)
npm run dev          # starts Express on :8787, Vite middleware inline

# Production build
npm run build        # build:client (Vite → client/dist) + build:server (tsc → dist/server)
npm start            # NODE_ENV=production node dist/server/index.js

# Type-check only (no emit)
npx tsc --noEmit
npx tsc -p tsconfig.server.json --noEmit
```

No test suite exists yet.

## Architecture

Single-process local web app. In dev, Express serves the API and embeds Vite as middleware — no separate client dev server needed. In production, Express serves the pre-built static files from `client/dist`.

```
server/         Express + better-sqlite3 backend (ESM, tsx in dev)
  index.ts      Entry point: mounts all routers, starts Vite middleware (dev) or static (prod)
  db.ts         Opens SQLite at data/app.db, runs migrations on import
  migrations.ts Schema: account, bucket, channel, unsubscribe_log, app_meta
  oauth.ts      Google OAuth2 helpers; tokens stored in the account table (row id=1)
  quota.ts      Tracks daily YouTube API quota against PT midnight rollover
  youtube.ts    Thin wrappers around googleapis subscriptions.list / delete
  routes/       One file per resource group

client/src/     React SPA (Vite, TypeScript)
  api.ts        All fetch calls to /api/*; unsubscribeStream() reads SSE via fetch + ReadableStream
  App.tsx       Root — holds all state, passes down to components

shared/types.ts Interfaces shared by server and client (imported via @shared alias in Vite)
```

## Key design decisions

**Single account row.** The `account` table enforces `id = 1`. Sign-in deletes and re-inserts. Multi-account is an explicit non-goal.

**`channel_id` vs `subscription_id`.** `channel_id` is the stable YouTube channel identifier and the primary key. `subscription_id` is volatile (changes if you re-subscribe) and is used only for the `subscriptions.delete` API call. A 404 on delete is treated as success (`stale_404`) and the channel is still marked unsubscribed locally.

**Quota tracking.** `quota.ts` keeps a running total in `app_meta` keyed by PT date. `recordQuota(units)` is called after each YouTube API call. The execute route hard-stops before a call that would exceed the budget rather than risk a mid-batch failure.

**SSE for bulk unsubscribe.** `POST /api/unsubscribe/:id/execute` streams `data: {...}\n\n` events as each channel is processed, then sends `{ done: true }`. The client (`api.ts:unsubscribeStream`) reads via `fetch` + `ReadableStream` and dispatches callbacks. The connection is abortable; the server checks an `aborted` flag set by `req.on("close")`.

**No build step in dev.** `npm run dev` uses `tsx watch` for the server and Vite's in-process middleware for the client. Editing either side hot-reloads without restarting.

## Environment

Copy `.env.example` to `.env`. Required vars:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

OAuth redirect URI must be `http://localhost:8787/api/auth/callback` in your Google Cloud console. The app runs on port 8787 (override with `PORT=`).

The SQLite DB lives at `data/app.db` (override with `DB_PATH=`). Delete it to reset all state.
