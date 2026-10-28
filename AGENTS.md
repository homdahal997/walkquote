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
- Room analysis runs in `src/lib/analyze-room.functions.ts` → `analyze-room.server.ts` via Lovable AI Gateway; segmentation returns polygon JSON that `decodeOptionalMask` rasterizes in the browser, replacing the unavailable SAM mask format.
- Live AI analysis and the server check are administrator-only (has_role 'admin' checked server-side), matching the source app's closed-testing behaviour.
- tsconfig runs with `strict: false` + `strictNullChecks: true` because the imported code was written for a non-strict config; TanStack Router requires strictNullChecks.
