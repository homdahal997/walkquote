# WalkQuote

**Walk the room. Get the quote.** A 30-second phone walkthrough becomes an itemized interior painting estimate, a realistic color preview, and a qualified lead for the painter. It runs on four Meta models.

**Live app:** https://walkquote.lovable.app
**Built for:** Meta Global AI Developer Hackathon, Indie Developer Track

![Meta Model API](https://img.shields.io/badge/Meta%20Model%20API-4%20models-0866FF) ![TanStack Start](https://img.shields.io/badge/TanStack%20Start-React%2019-FF4154) ![Tests](https://img.shields.io/badge/tests-vitest-6E9F18)

---

## The problem

Painting contractors spend 10 to 15 unpaid hours a week driving to homes just to measure rooms and write quotes. Many of those quotes go to homeowners whose budget never matched the job. Homeowners can't picture a new color until the walls are already painted.

## What WalkQuote does

1. **Homeowner** records or uploads a short room video and talks through what they want painted.
2. **Four Meta models** turn it into room geometry, an opening count, wall masks, and an itemized scope with labor, materials, and gallons.
3. **Homeowner** sees the price range compared with their budget, edits line items, and previews colors on their own walls.
4. **Contractor** gets a qualified lead in their inbox with the evidence attached: frames, masks, transcript, and confidence flags.

## The Meta AI pipeline

| Stage | Model | Role |
|---|---|---|
| Listen | `muse-voice-transcribe-1.0` | Transcribes the homeowner's spoken scope ("just the walls, skip the ceiling") |
| See | `muse-spark-1.3` | Reasons across multiple views: wall count, dimensions, doors and windows, ceiling type, trim and crown, surface condition |
| Segment | `sam-3.1` | Segments walls, doors, windows, and trim per frame as pixel masks |
| Repaint | `muse-image-1.0` | Realistically repaints the room. The result is composited through SAM's wall mask so only the walls change |

All calls go to `https://api.meta.ai/v1` from the server. No other AI providers are used.

## Engineering highlights

- **Two-model consensus:** Muse Spark's door and window counts are cross-checked against SAM 3.1 detections, and any disagreement is shown in the UI.
- **Scale calibration:** dimensions are anchored to standard references such as an 80″ door. Every measurement is labeled with its basis.
- **Voice vs. vision reconciliation:** spoken instructions are compared with what the camera actually saw.
- **Evidence and confidence flags:** each line item is marked *Grounded* or *Confirm on site*. Peeling, water stains, cracks, and possible lead paint are flagged.
- **Materials takeoff:** gallons per coat (350 sq ft/gal), recommended sheen, and whether primer is needed.
- **Resilient API layer:** one bounded retry for 429/5xx that honors `Retry-After` within the original timeout. Ambiguous failures are never replayed, so credits are never spent twice.
- **Server-enforced guest quotas:** per-visitor and site-wide daily limits. Interrupted stages can resume without bypassing the quota.
- **Mobile-first capture:** raw PCM to WAV recording, with a fallback that extracts the soundtrack from uploaded videos for iOS/WebKit.
- **Golden-run replay:** saved authentic Meta outputs replay instantly with zero API calls. Replays are clearly labeled and can never be submitted as real leads.

## Try it (judges)

| Path | What you'll see |
|---|---|
| [`/walkthrough`](https://walkquote.lovable.app/walkthrough) → **Open golden-run demo** | A full saved Meta run that loads instantly and makes no live calls |
| `/walkthrough` → **Use sample video for quick test** | Real frame extraction in the browser and a live 4-model run on a known-good video |
| `/walkthrough` → record or upload your own room | A live run. No sign-in needed (daily guest limit applies) |
| [`/contractor?view=demo`](https://walkquote.lovable.app/contractor?view=demo) | Contractor inbox with sample leads |
| `/login` → **Fill judge credentials** | Admin access to the live contractor inbox |

## Tech stack

- **Framework:** TanStack Start v1 (React 19, SSR, server functions) on Vite 7
- **Runtime:** Cloudflare Workers (edge)
- **Styling:** Tailwind CSS v4
- **Backend:** Lovable Cloud (Postgres with row-level security, auth, storage)
- **Segmentation decoding:** `@meta-sam/parser` in the browser
- **Tests:** Vitest + Testing Library

```text
Phone video + voice
   |-- frames ------> Muse Spark 1.3 ----> geometry, openings, conditions
   |-- frames ------> SAM 3.1 -----------> wall / door / window masks
   |-- audio -------> Muse Voice --------> spoken scope
                         |
                 consensus + pricing ----> itemized estimate, gallons, flags
                         |
      Muse Image 1.0 + SAM mask ---------> realistic color preview
                         |
                 contractor inbox (leads)
```

## System architecture

WalkQuote is a full-stack TanStack Start app deployed to the edge. The browser never touches a Meta endpoint directly, and no AI key ever reaches client code.

```text
┌────────────────────────── Browser ───────────────────────────┐
│  Capture UI (camera / upload / sample video)                 │
│  Frame extraction · WAV decoding · SAM mask decoding         │
│  (@meta-sam/parser) · line-item editor · color preview       │
└──────────────┬───────────────────────────────────────────────┘
               │  server function calls (auth token attached)
┌──────────────▼──────────── Edge runtime (Cloudflare Workers) ─┐
│  analyze-room.server.ts  — the Meta orchestration layer       │
│    • stage reservation + guest quotas (per-visitor/site/day)  │
│    • one bounded retry for 429/5xx, honors Retry-After        │
│    • META_MODEL_API_KEY stays server-side, never serialized   │
└───────┬─────────────────────────────┬─────────────────────────┘
        │ https://api.meta.ai/v1      │
┌───────▼──────────┐        ┌─────────▼──────────────────────────┐
│  Meta Model API  │        │  Lovable Cloud (Postgres)          │
│  muse-voice-     │        │  attempts, stages, quotes, leads   │
│  transcribe 1.0  │        │  row-level security per session    │
│  muse-spark 1.3  │        │  roles in a protected user_roles   │
│  sam-3.1         │        │  table (never user-editable meta)  │
│  muse-image 1.0  │        │  golden-run assets on CDN          │
└──────────────────┘        └────────────────────────────────────┘
```

Key architectural decisions:

1. **Server-only AI boundary:** all four Meta models are called from the server orchestration layer. `META_MODEL_API_KEY` lives in a server-side secret store and is never bundled, logged, or returned to the browser.
2. **Browser-side pixel work:** video frame extraction, WAV audio decoding, and SAM mask decoding run in the browser, so large media never round-trips through the server and the mask composite happens instantly on the client.
3. **Spend protection:** each stage is reserved atomically before a Meta call, guest limits are enforced server-side (the admin role bypasses them), retries are bounded to one delayed attempt for 429/5xx within the original timeout, and ambiguous network failures are never replayed. Cached renders are keyed by attempt, view, and color to avoid repeat `muse-image-1.0` calls.
4. **Data privacy & multi-tenancy:** row-level security keeps quotes visible only to their session's homeowner, while contractors read leads through a verified role table. Golden-run replays load saved authentic Meta outputs from CDN assets with zero API calls and can never be submitted as real leads.

## Project structure

```text
src/
  routes/                 pages (home, walkthrough, contractor, auth)
  components/estimate/    wizard, capture, editor, previews, inspector
  lib/
    analyze-room.server.ts   Meta Model API pipeline (server only)
    meta-retry.ts            bounded retry helper
    room-sizes.ts            shared room math + SAM/Spark cross-check
    pricing.ts               line items, labor, materials
    analysis-limits.ts       guest quota values
    golden-run.ts            saved-run replay
  test/                   Vitest suites
supabase/                 database migrations
```

## Local development

Requirements: Node 20+ or Bun.

```sh
git clone <this-repo-url>
cd walkquote
bun install          # or npm install
cp .env.example .env # fill in your own values
bun run dev
```

Run the tests:

```sh
bun run test
```

### Environment variables

See [`.env.example`](.env.example). `VITE_*` values are publishable browser keys. `META_MODEL_API_KEY` and the service-role key are **server-only secrets**. Set them in your hosting provider's secret store and never commit them.

## Limitations

Measurements from photos are estimates, not tape-measure readings. WalkQuote qualifies leads and produces a grounded starting quote, and any line item marked *Confirm on site* should be checked in person.

## License

MIT
