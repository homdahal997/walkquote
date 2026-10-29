# WalkQuote — PRD
Meta Global AI Developer Hackathon entry. Interior painting estimate from a room walkthrough (live video, uploaded video, or photos) using Meta Model API: muse-spark-1.3, sam-3.1, muse-voice-transcribe-1.0 (unchanged, not mocked).
Stack: TanStack Start v1 (React 19, Vite, Tailwind v4), Cloudflare Workers, Lovable Cloud/Supabase.

## Done (Oct 2026)
- `/` marketing landing (src/components/landing/LandingPage.tsx); wizard moved to `/walkthrough`; logo -> `/`; demo links -> /walkthrough?experience=demo
- Upload recorded video (<=120MB, <=3 min); frames extracted client-side; WebM without duration header handled; large videos submit 4 review frames instead of full video (storage cap 2.3MB)
- SAM: wall prompts interior wall/wall/painted wall tried in turn, concurrency 3, 1 retry on 429/5xx after 500ms, preview falls back to another frame's wall mask
- Slider: left Original Room, right Color Preview, tint clipped right of divider, starts at 50
- Tests 21/21, build OK
- AI at Work panel (src/components/estimate/ModelInspector.tsx): live per-model cards (Muse Voice, Muse Spark, SAM 3.1) with status, per-stage clock, real outputs (transcript, room type/counts/dimensions/basis/observations, SAM concepts + mask overlay + door/window cross-check); wall overlay on main analysis frame; 1.4s hold after SAM; concepts shared via src/lib/sam-concepts.ts
- Clearer errors: thrown/unreachable service vs server-provided messages; voice failure distinguished from silence; no raw config details in toasts
- Tests 26/26 (src/test/model-inspector.test.tsx added), build OK
- Note: preview lacks SUPABASE_SERVICE_ROLE_KEY and META_MODEL_API_KEY, so live analysis fails in preview

## Backlog (robustness first)
- P0: friendly config check when the usage store or Meta key is missing (structured error instead of thrown)
- P1: automatic retry of a failed stage within the same attempt; per-stage timeouts surfaced in the panel
- P1: client-side downscale and validation of oversized frames before upload
- P2: sample walkthrough video on landing, color comparisons, shareable quote link
