<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules (WalkQuote, migrated from a Buildy/Superdev app)
- `src/entities/index.ts` keeps the old entity-manager API (create/get/query) on top of Lovable Cloud tables so the imported estimate components stay unchanged; anonymous inserts generate ids client-side and never request a returning row because RLS hides rows from visitors.
- Live AI analysis is open to guests with per-visitor and site-wide daily limits enforced server-side in `reserveStage`; the administrator (has_role admin) skips limits. The server check stays admin-only.
- tsconfig runs with `strict: false` + `strictNullChecks: true` because the imported code was written for a non-strict config; TanStack Router requires strictNullChecks.
- Contractor demo mode (`/contractor?view=demo`) renders static sample leads from `src/lib/sample-leads.ts` and never queries the database.

- Room analysis must use the Meta Model API (muse-spark-1.3, sam-3.1, muse-voice-transcribe-1.0, muse-image-1.0) with META_MODEL_API_KEY in `analyze-room.server.ts`; the app is a Meta hackathon entry, so never substitute other providers. SAM needs short noun-phrase concepts (one per call); the browser decodes masks with `@meta-sam/parser`. The realistic wall repaint is a `render` stage capped at 6 per attempt; the browser composites the Muse Image result through SAM's wall mask so only wall pixels change.- Room size math, room naming and the SAM-vs-Muse door/window cross-check live in `src/lib/room-sizes.ts`; server and UI both import it so the numbers never disagree.
