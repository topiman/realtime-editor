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

**Room model.** The room name is derived from `location.pathname` on the frontend (e.g. `/work` → room `work`, `/` → room `default`). `rooms[name] = { text, files: {[id]: {meta, blob, bytes}}, totalBytes }` — text is one envelope; files is a dict of attachments. Text sync is last-write-wins (`edit` → `update`); files use per-id `addFile`/`fileAdded`/`removeFile`/`fileRemoved` events. Last person to leave the room triggers room destruction via `disconnecting` — there is no persistence.

**End-to-end encryption.** AES-GCM 256-bit, key lives in URL fragment (`#k=<43 char base64url>`), never sent to the server. Envelope format `<fp>.<iv>.<ct>` where `fp` is a 4-byte SHA-256 key fingerprint. Binary helpers `encryptBytes`/`decryptBytes` in `frontend/index.html`; text helpers (`encryptMsg`/`decryptMsg`) wrap them. The server has no decrypt path — all of `text`/`meta`/`blob` are opaque strings.

**File quotas.** 20MB per file / 100MB per room, enforced server-side; oversized uploads get `fileError`. `maxHttpBufferSize` is raised to 25MB in `backend/server.js` to carry one 20MB ciphertext + socket.io framing. Frontend pre-checks 14MB raw (≈ 20MB after AES-GCM tag + base64 inflation).

**/rooms metadata.** `GET /rooms` on the backend returns room-level metadata (name, client count, fileCount, totalBytes, text fingerprint) — no plaintext. Exposed on `frontend/rooms.html` as a table.

**Vercel rewrite.** `frontend/vercel.json` routes `/rooms` to `rooms.html` and everything else to `/index.html`, which is what makes arbitrary URL suffixes work as room names. Without this rewrite, hitting `/work` would 404.

**Deployment coupling to be aware of.** The frontend and backend are in the same repo but deployed separately. Railway builds from `backend/`; Vercel builds from `frontend/`. A backend URL change requires a frontend edit + redeploy — there is no runtime config.
