# WalkQuote: Landing Page, Video Upload and a Working Paint Preview

WalkQuote turns a short room walkthrough (live recording, uploaded video or photos) into an itemized interior painting estimate with a live wall-colour preview, using Meta's Muse Spark 1.3, SAM 3.1 and Muse Voice models.
This round gives the app a proper front door, accepts videos homeowners have already recorded, and makes the before/after colour preview work on real-world videos, so the Meta Global AI Developer Hackathon demo holds up live.

## Who it's for
- **Homeowners** who want a fast, believable painting quote without booking a visit.
- **Painting contractors** who get structured, pre-measured jobs (shown through the existing contractor demo).
- **Hackathon judges**, who score Impact (30%), Use of Meta AI Tooling (25%), Technical Depth (20%) and Demo (25%). Every change below is aimed at one of these.

## Core features and experience
1. **Marketing landing page at `/`**
   - Hero: "Instant Interior Painting Estimates from a 30-Second Room Walk."
   - Subtitle explains that Muse Spark reads the room and SAM 3.1 picks out the walls, trim and openings.
   - Main button: "Start Walkthrough" (goes to `/walkthrough`). Second button: "View Contractor Demo".
   - Three "How It Works" cards: Walk & Record (or upload video/photos), Instant Multimodal Assessment (wall area, doors/windows, prep), Live Color Preview & Itemized PDF Quote.
   - A hackathon pill that names the Meta Model API models (Muse Spark 1.3, SAM 3.1, Muse Voice), so judges can see which Meta models are used.
2. **Dedicated walkthrough page at `/walkthrough`**
   - The existing estimate wizard moves here, with its own page title and description.
   - The logo or back control in the wizard always returns to the landing page.
3. **Upload a recorded video**
   - Next to "Start walkthrough" there is an "Upload recorded video" button that opens the phone library or desktop file picker.
   - Files over 120 MB are turned down with a clear message asking the homeowner to trim the video.
   - Representative frames are pulled from the video and fed into the same estimate flow as a live recording.
   - If a video can't be read, the message suggests MP4/WebM/MOV or 3–4 photos instead.
4. **Reliable before/after paint preview**
   - Wall detection asks SAM 3.1 for "interior wall", "wall" and "painted wall", so flat or unevenly lit walls are still found.
   - Fewer requests go to the Meta API at the same time (3 instead of 6). A rate-limit or server error gets one retry after a short pause. An empty wall result gets one retry using "wall".
   - If the main frame still has no wall result, the preview uses the best wall result from another frame, so the preview stays available.
   - Slider fix: the left side is "Original Room" and the right side is "Color Preview". Dragging right shows more colour. The slider starts halfway.

## User flow
1. A visitor lands on `/`, reads the hero and the three steps, and taps **Start Walkthrough**.
2. On `/walkthrough` they record live, **upload a recorded video**, or add photos.
3. Muse Spark assesses the room, SAM 3.1 segments the surfaces and Muse Voice transcribes any spoken notes.
4. They see the itemized estimate, drag the before/after slider to try a wall colour, and get the PDF quote.
5. At any point they can tap the logo to go back to the landing page. Contractors can open the demo from the landing page.

## UI/UX feel
- The landing page uses the app's current colours, type and components, so the jump to the walkthrough feels seamless.
- It is clean and confident, with generous spacing, clear calls to action, and works well on a phone first.
- The upload button sits next to the record button with the same size and weight. Error messages are plain and tell the homeowner what to do next.

## Implementation phases
**Phase 1 (MVP, built now)**
- Landing page at `/` and the wizard moved to `/walkthrough`, with a link back home.
- Recorded video upload with the size limit, frame extraction and friendly errors.
- Reliability fixes for the paint preview (wider wall prompts, gentler API concurrency, one retry, fallback to another frame) and the slider orientation fix with a halfway start.
- Existing tests pass and the production build has no errors.

**Phase 2: Show off the models (Use of Meta AI Tooling, Demo)**
- An "AI at work" panel during analysis that shows each model's stage as it happens: Muse Spark reasoning, SAM 3.1 masks over the frames, Muse Voice transcript.
- Optional overlay on the result showing the detected wall, trim and opening areas.
- A polished sample walkthrough video on the landing page for a dependable live demo.

**Phase 3: Production polish (Impact, Technical Depth)**
- Saving several colour comparisons side by side, and a shareable quote link.
- Contractor-side review of uploaded walkthroughs, plus confidence notes on each measurement.
- Background progress and resume for long uploads on slow mobile connections.

## Assumptions
- Environment settings, the Meta API endpoint, the key handling and the three models (muse-spark-1.3, sam-3.1, muse-voice-transcribe-1.0) stay exactly as they are. Nothing is mocked.
- The 120 MB upload limit and the wording of the error messages follow the brief.
- The video length shown starts as a placeholder and is replaced by the real length once frames are extracted.
- The contractor demo route and its "demo" view already exist and are only linked from the landing page.
- Photo upload and live recording keep working as they do today.
- Scope for this round stays to the three issues in the brief. Everything else that would push the models harder for judging is in phases 2–3.
