# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Backend (from `backend/`):
```bash
npm install
node server.js          # or: npm start — listens on PORT env or 3001
```

Frontend (from `frontend/`): static site, no build step. Open `index.html` directly in a browser, or `vercel dev` if a full Vercel-like environment is needed. When testing locally, temporarily point `BACKEND_URL` in `index.html` at `http://localhost:3001`.

No test, lint, or typecheck tooling is configured.

## Architecture

Two independently deployed pieces wired together by a hardcoded URL:

- **`backend/server.js`** — Express + Socket.IO server, deployed to Railway (`Procfile`: `web: node server.js`). State lives in a single in-memory `rooms` object keyed by room name; there is no persistence, so a restart wipes all documents.
- **`frontend/index.html`** — single static file, deployed to Vercel. The Socket.IO endpoint is hardcoded in `BACKEND_URL` near the top of the `<script>` block; changing backends means editing this constant and redeploying.

**Room model.** The room name is derived from `location.pathname` on the frontend (e.g. `/work` → room `work`, `/` → room `default`). On connect, the client emits `join <room>`; the server sends back `init <content>` with the current room contents. Subsequent `edit` events carry the full textarea value and the server broadcasts `update` to everyone else in the room (`socket.to(room).emit`, so the sender is excluded). Sync is last-write-wins on the whole document — there is no CRDT/OT, no diff, no per-user cursor tracking beyond restoring the local caret after a remote update.

**Vercel rewrite.** `frontend/vercel.json` rewrites every path to `/index.html`, which is what makes arbitrary URL suffixes work as room names on the deployed site. Without this rewrite, hitting `/work` would 404.

**Deployment coupling to be aware of.** The frontend and backend are in the same repo but deployed separately. Railway builds from `backend/`; Vercel builds from `frontend/`. A backend URL change requires a frontend edit + redeploy — there is no runtime config.
