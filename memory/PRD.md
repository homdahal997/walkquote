# WalkQuote — PRD
Meta Global AI Developer Hackathon entry. Interior painting estimate from a room walkthrough (live video, uploaded video, or photos) using Meta Model API: muse-spark-1.3, sam-3.1, muse-voice-transcribe-1.0 (unchanged, not mocked).
Stack: TanStack Start v1 (React 19, Vite, Tailwind v4), Cloudflare Workers, Lovable Cloud/Supabase.

## Done (Oct 2026)
- `/` marketing landing (src/components/landing/LandingPage.tsx); wizard moved to `/walkthrough`; logo -> `/`; demo links -> /walkthrough?experience=demo
- Upload recorded video (<=120MB, <=3 min); frames extracted client-side; WebM without duration header handled; large videos submit 4 review frames instead of full video (storage cap 2.3MB)
- SAM: wall prompts interior wall/wall/painted wall tried in turn, concurrency 3, 1 retry on 429/5xx after 500ms, preview falls back to another frame's wall mask
- Slider: left Original Room, right Color Preview, tint clipped right of divider, starts at 50
- Tests 21/21, build OK

## Backlog
- P1: "AI at work" panel showing each model stage; overlay of wall/trim/opening masks
- P1: sample walkthrough video on landing for live demo
- P2: side-by-side color comparisons, shareable quote link, contractor review of uploads, resumable uploads
