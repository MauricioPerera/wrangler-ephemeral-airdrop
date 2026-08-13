# 📦 Ephemeral Airdrop

🌐 [Español](./README.md) · **English** · [Português](./README.pt.md)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MauricioPerera/wrangler-ephemeral-airdrop)

🌐 **[Landing page](https://mauricioperera.github.io/wrangler-ephemeral-airdrop/)** — visual presentation of the project, available in español / English / português.

Upload a file, get a **QR code and a link**, send it to someone, and they download it — without ever having been connected before, no app to install. Runs on a **Cloudflare temporary account**, no login, and **self-destructs** in ~1 hour.

Sibling of [wrangler-ephemeral-chat](https://github.com/MauricioPerera/wrangler-ephemeral-chat) ([landing page](https://mauricioperera.github.io/wrangler-ephemeral-chat/)) and [wrangler-ephemeral-whiteboard](https://github.com/MauricioPerera/wrangler-ephemeral-whiteboard) ([landing page](https://mauricioperera.github.io/wrangler-ephemeral-whiteboard/)) — same temporary account, same Durable Object idea, but for passing along a one-off file.

Also a sibling of [wrangler-ephemeral-webhook](https://github.com/MauricioPerera/wrangler-ephemeral-webhook) ([landing page](https://mauricioperera.github.io/wrangler-ephemeral-webhook/)) — for inspecting incoming webhooks live — and [wrangler-ephemeral-voicememo](https://github.com/MauricioPerera/wrangler-ephemeral-voicememo) ([landing page](https://mauricioperera.github.io/wrangler-ephemeral-voicememo/)) — for recording and sharing a voice memo.

## How it works

- `wrangler deploy --temporary` creates a temporary Cloudflare account (no login) and deploys the Worker.
- You upload a file from the page → it's split into 1MB chunks and stored as `BLOB` rows in the SQLite of a Durable Object unique to that file (identified by a random token).
- You get a `/file/<token>` link with a QR code. Anyone who opens it — **without having been connected before** — sees the name/size and downloads the file with one click. None of this uses WebSockets, it's plain HTTP.
- Everything — Worker, file, account — disappears on its own an hour after creation.

## Requirements

- Node.js
- Wrangler **4.102.0 or later**
- **Not logged in** to Wrangler (`wrangler logout` if you already have a session)

## Deploy

```bash
git clone https://github.com/MauricioPerera/wrangler-ephemeral-airdrop.git
cd wrangler-ephemeral-airdrop
npm install
npx wrangler deploy --temporary
```

Open the URL, upload a file, share the link or QR. If you want to keep the Worker permanently, open the claim URL wrangler prints and complete the login before the hour is up.

### Permanent deploy (optional)

`wrangler login` + `npx wrangler deploy` instead of `--temporary`, or the **Deploy to Cloudflare** button above.

## Features

- **Drag & drop upload** or file picker, with a progress bar
- **QR code generated in the browser** pointing to the download link (`qrcodejs` via CDN, no QR backend)
- **Download without prior connection**: the receiver just opens the link — it's plain HTTP (`GET` + `Content-Disposition: attachment`), not WebSocket
- **Download page with metadata**: name, size, download count, and countdown banner
- **Verified byte-for-byte**: tested with files up to 18MB, identical hash between upload and download

## Limits (tested, not just theoretical)

- **20MB per file** (a self-imposed limit, configurable via `MAX_FILE_SIZE` in `src/index.js`) — meant to avoid stressing the Worker/Durable Object memory when reconstructing the whole file in a single `fetch`.
- Upload speed depends on your connection (not the Worker) — download is consistently fast (~3-4 MB/s in testing).
- Each file lives in its own Durable Object (per token), so it doesn't share quota with other files beyond the temporary account's total storage.
- No R2 on temporary accounts — that's why the file is split into 1MB chunks and stored as rows in the Durable Object's own native SQLite (not D1, which is capped at 100MB on temporary accounts).

More on temporary accounts: [Claim deployments · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/claim-deployments/)

## Structure

```
src/index.js       — Worker + Durable Object (Drop) + upload/download pages
wrangler.jsonc      — Worker config and Durable Object binding
```

## Are you an AI agent?

See [AGENTS.md](./AGENTS.md) for autonomous deployment instructions with `wrangler --temporary`.
