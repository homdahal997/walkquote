import { fetchMetaWithRetry } from "./meta-retry";
import { VISITOR_DAILY_LIMIT, SITE_DAILY_LIMIT } from "./analysis-limits";
import {
  MAX_MASK_TEXT_CHARS,
  MAX_SEGMENTATION_BUNDLE_CHARS,
  ROOM_IMAGES,
  SURFACE_PROMPTS,
  buildObservePrompt,
  countSamBoxes,
  parseObservationJson,
  redactPrivateStrings,
  validateRoomFrames,
  validateWavBase64,
  validateRenderRequest,
  buildRenderPrompt,
  type AnalysisSourceId,
  type Stage,
} from "./analyze-room.shared.server";

// Meta Model API (hackathon models): Muse Spark for room review, SAM 3.1 for surface masks,
// Muse Voice Transcribe for spoken notes, Muse Image for the realistic wall repaint.
const META_API = "https://api.meta.ai/v1";
const OBSERVE_MODEL = "muse-spark-1.3";
const SEGMENT_MODEL = "sam-3.1";
const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";
const RENDER_MODEL = "muse-image-1.0";
const MAX_RENDERS_PER_ATTEMPT = 6;
const RESEND_WINDOW_MS = 2 * 60 * 1000;
const MAX_RENDER_BASE64_CHARS = 8_000_000;
const DAILY_MS = 24 * 60 * 60 * 1000;

type Json = Record<string, unknown>;

export interface AnalyzeInput {
  operation?: unknown;
  stage?: unknown;
  sourceId?: unknown;
  sampleId?: unknown;
  attemptId?: unknown;
  audioBase64?: unknown;
  transcript?: unknown;
  frames?: unknown;
  frame?: unknown;
  colorHex?: unknown;
  colorName?: unknown;
  size?: unknown;
  renderId?: unknown;
}

class GatewayError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
  }
}

function apiKey() {
  const key = process.env["META_MODEL_API_KEY"];
  if (!key) throw new GatewayError(503, "The room analysis service is not configured.", "SERVICE_UNCONFIGURED");
  return key;
}

function metaHeaders(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", ...extra };
}

async function failFromResponse(response: Response): Promise<never> {
  const body = await response.text().catch(() => "");
  console.error("analyze-room meta api error", response.status, body.slice(0, 500));
  if (response.status === 429) throw new GatewayError(429, "The analysis service is busy right now. Wait a minute and retry.");
  if (response.status === 402) throw new GatewayError(402, "Room analysis is paused because Meta API credits ran out. Please try again later.");
  throw new GatewayError(response.status, "Room analysis did not finish. Please retry.");
}

function outputText(payload: unknown) {
  const output = (payload as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> })?.output;
  if (!Array.isArray(output)) return "";
  return output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

async function transcribe(bytes: Uint8Array) {
  const form = new FormData();
  form.set(
    "request",
    new Blob([JSON.stringify({ mode: "PUSH_TO_TALK", model: TRANSCRIBE_MODEL, audioEncoding: "WAV" })], { type: "application/json" }),
    "request.json",
  );
  form.set("audio", new Blob([bytes as unknown as BlobPart], { type: "audio/wav" }), "room-note.wav");
  const sessionId = crypto.randomUUID();
  const response = await fetchMetaWithRetry((signal) => fetch(`${META_API}/asr/transcribe?sessionId=${sessionId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
    body: form,
    signal,
  }));
  if (!response.ok) await failFromResponse(response);
  const result = (await response.json()) as { transcript?: unknown };
  if (typeof result.transcript !== "string") throw new GatewayError(502, "Room analysis did not finish. Please retry.");
  return redactPrivateStrings(result.transcript);
}

async function observe(imageUrls: string[], transcript: string, sourceId: AnalysisSourceId) {
  const prompt = buildObservePrompt(transcript, sourceId);
  const response = await fetchMetaWithRetry((signal) => fetch(`${META_API}/responses`, {
    method: "POST",
    headers: metaHeaders(),
    body: JSON.stringify({
      model: OBSERVE_MODEL,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            // Numbered views let Muse Spark track overlap between consecutive frames of the walk.
            ...imageUrls.flatMap((url, index) => [
              { type: "input_text", text: `View ${index + 1} of ${imageUrls.length}` },
              { type: "input_image", image_url: url },
            ]),
          ],
        },
      ],
    }),
    signal,
  }));
  if (!response.ok) await failFromResponse(response);
  const text = outputText(await response.json());
  if (!text || text.length > 8000) throw new GatewayError(502, "Room analysis did not finish. Please retry.");
  return parseObservationJson(text, transcript);
}

/** Muse Image repaints the walls of one room view; the browser trims it to SAM 3.1's wall mask. */
async function renderWalls(imageUrl: string, colorName: string, colorHex: string, size?: string) {
  const response = await fetchMetaWithRetry((signal) => fetch(`${META_API}/images/edits`, {
    method: "POST",
    headers: metaHeaders(),
    body: JSON.stringify({
      model: RENDER_MODEL,
      prompt: buildRenderPrompt(colorName, colorHex),
      images: [{ image_url: imageUrl }],
      n: 1,
      ...(size ? { size } : {}),
      response_format: "b64_json",
      output_format: "jpeg",
    }),
    signal,
  }), { timeoutMs: 58_000 });
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel().catch(() => undefined);
    throw new GatewayError(response.status, "The realistic preview is not available right now. The color tint preview still works.");
  }
  if (!response.ok) await failFromResponse(response);
  const payload = (await response.json()) as { data?: Array<{ b64_json?: unknown }>; output_format?: unknown };
  const encoded = payload.data?.[0]?.b64_json;
  if (typeof encoded !== "string" || encoded.length < 100 || encoded.length > MAX_RENDER_BASE64_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new GatewayError(502, "The realistic preview did not finish. Please retry.");
  }
  const format = payload.output_format === "png" || payload.output_format === "webp" ? payload.output_format : "jpeg";
  return { renderImage: `data:image/${format};base64,${encoded}`, renderModel: RENDER_MODEL };
}

/** Runs one SAM 3.1 concept prompt and returns its raw segmentation line (empty when nothing matched). */
async function samConcept(imageUrl: string, concept: string) {
  const response = await fetchMetaWithRetry((signal) => fetch(`${META_API}/responses`, {
    method: "POST",
    headers: metaHeaders(),
    body: JSON.stringify({
      model: SEGMENT_MODEL,
      metadata: { mask_encoding: "one_bit" },
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: concept }, { type: "input_image", image_url: imageUrl }] },
      ],
    }),
    signal,
  }));
  if (!response.ok) await failFromResponse(response);
  return outputText(await response.json()).trim();
}

/** Tries each wall concept in turn (then a plain "wall" retry) until SAM 3.1 returns a mask. */
async function samWalls(imageUrl: string) {
  const concepts = Array.from(new Set<string>([...SURFACE_PROMPTS.walls, "wall"]));
  let lastError: unknown = null;
  for (const concept of concepts) {
    try {
      const line = await samConcept(imageUrl, concept);
      if (tryMerge([line])) return line;
    } catch (error) {
      if (error instanceof GatewayError && error.status < 500) throw error;
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return "";
}

/**
 * Segments one surface type with SAM 3.1. Several concepts are merged into one frame line
 * with re-numbered object ids so the browser decodes it with @meta-sam/parser.
 */
function mergeConceptLines(lines: string[]) {
  const records: string[] = [];
  for (const line of lines) {
    const body = line.replace(/^<0f>/, "");
    if (!body) continue;
    for (const match of body.matchAll(/(?:^|,)\d+(<\|box;[^|]*\|><\|mask;[\s\S]*?\|>)(?=,\d+<\|box|$)/g)) {
      if (records.length < 16) records.push(`${records.length}${match[1]}`);
    }
  }
  if (records.length === 0) throw new Error("segmentation-empty");
  const out = `<0f>${records.join(",")}`;
  if (out.length > MAX_MASK_TEXT_CHARS) throw new Error("segmentation-too-large");
  return out;
}

async function segment(imageUrl: string, concepts: readonly string[]) {
  return mergeConceptLines(await Promise.all(concepts.map((concept) => samConcept(imageUrl, concept))));
}

function tryMerge(lines: Array<string | null>) {
  try {
    return mergeConceptLines(lines.filter((line): line is string => typeof line === "string"));
  } catch {
    return null;
  }
}

/** Runs jobs with a small concurrency cap so one room does not flood the Meta API. */
async function settleWithLimit<T>(jobs: Array<() => Promise<T>>, limit = 3) {
  const results: PromiseSettledResult<T>[] = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await jobs[index]() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
  return results;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function utcResetAt(now: number) {
  const dayStart = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00.000Z`);
  return new Date(dayStart + DAILY_MS).toISOString();
}

function quotaReply(reason: "VISITOR_DAILY_LIMIT" | "SITE_DAILY_LIMIT") {
  const message = reason === "VISITOR_DAILY_LIMIT"
    ? `This internet connection has reached its daily limit of ${VISITOR_DAILY_LIMIT} estimate runs.`
    : `WalkQuote has reached its daily limit of ${SITE_DAILY_LIMIT} estimate runs.`;
  return { error: message, errorCode: reason, message, resetsAt: utcResetAt(Date.now()) };
}

/** Reserves one stage of one attempt against the per-visitor and site-wide daily limits. */
async function reserveStage(visitorAddress: string, attemptId: string, stage: Stage) {
  let supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin;
  try {
    ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
  } catch {
    return { error: "The estimate service is not set up yet. The demo walkthrough still works.", errorCode: "SERVICE_UNCONFIGURED", message: "The estimate service is not set up yet. The demo walkthrough still works." };
  }
  const visitorHash = await sha256Hex(`walkquote-visitor:${visitorAddress}`);
  const day = new Date().toISOString().slice(0, 10);

  let rows: Array<{ attempt_id: string; visitor_hash: string; stage: string; created_at: string }> = [];
  try {
    const { data, error } = await supabaseAdmin
      .from("analysis_usage")
      .select("attempt_id, visitor_hash, stage, created_at")
      .eq("day", day);
    if (error) throw error;
    rows = data ?? [];
  } catch {
    return { error: "The estimate service cannot safely start right now. Try again in a little while.", errorCode: "USAGE_LIMIT_UNAVAILABLE", message: "The estimate service cannot safely start right now. Try again in a little while." };
  }
  const alreadyUsed = { error: "This analysis step was already used. Start a fresh analysis.", errorCode: "STAGE_ALREADY_USED" };
  // A lost response can leave a stage reserved. Allow exactly ONE resend of the same
  // attempt+stage, by the same visitor, within RESEND_WINDOW_MS; anything else is blocked
  // so a replayed stage cannot make unlimited Meta calls without spending a daily run.
  const tryResend = async (reservedAt: string | undefined) => {
    const reserved = rows.find((row) => row.attempt_id === attemptId && row.stage === stage);
    const at = Date.parse(reservedAt ?? reserved?.created_at ?? "");
    if (!reserved || reserved.visitor_hash !== visitorHash || !(Date.now() - at <= RESEND_WINDOW_MS)) return alreadyUsed;
    const { error: resendError } = await supabaseAdmin
      .from("analysis_usage")
      .insert({ day, visitor_hash: visitorHash, attempt_id: attemptId, stage: `resend:${stage}` });
    return resendError ? alreadyUsed : { resumed: true as const };
  };
  const isKnownStage = rows.some((row) => row.attempt_id === attemptId && row.stage === stage);
  if (isKnownStage) return tryResend(undefined);
  const isKnownAttempt = rows.some((row) => row.attempt_id === attemptId);
  if (stage.startsWith("render-")) {
    // Previews belong to an analysed room: they never start a new estimate run, and are capped per run.
    if (!isKnownAttempt) return { error: "Analyze the room before asking for a realistic preview.", errorCode: "RENDER_NEEDS_ANALYSIS" };
    const renders = rows.filter((row) => row.attempt_id === attemptId && String(row.stage).startsWith("render-")).length;
    if (renders >= MAX_RENDERS_PER_ATTEMPT) return { error: `This room already has ${MAX_RENDERS_PER_ATTEMPT} realistic previews. The color tint preview still works for other colors.`, errorCode: "RENDER_LIMIT" };
  }
  if (!isKnownAttempt) {
    const visitorAttempts = new Set(rows.filter((row) => row.visitor_hash === visitorHash).map((row) => row.attempt_id));
    if (visitorAttempts.size >= VISITOR_DAILY_LIMIT) return quotaReply("VISITOR_DAILY_LIMIT");
    const siteAttempts = new Set(rows.map((row) => row.attempt_id));
    if (siteAttempts.size >= SITE_DAILY_LIMIT) return quotaReply("SITE_DAILY_LIMIT");
  }
  const { error } = await supabaseAdmin
    .from("analysis_usage")
    .insert({ day, visitor_hash: visitorHash, attempt_id: attemptId, stage });
  if (error) {
    // A concurrent resubmission raced us: it gets the same single-resend rule.
    if (error.code === "23505") {
      rows.push({ attempt_id: attemptId, visitor_hash: visitorHash, stage, created_at: new Date().toISOString() });
      return tryResend(undefined);
    }
    return { error: "The estimate service cannot safely start right now. Try again in a little while.", errorCode: "USAGE_LIMIT_UNAVAILABLE", message: "The estimate service cannot safely start right now. Try again in a little while." };
  }
  return null;
}

function isQuotaBlock(value: unknown): value is { error: string; errorCode: string; message?: string; resetsAt?: string } {
  return typeof value === "object" && value !== null && "errorCode" in value;
}

/** Frees a stage reservation after a model failure so the same attempt can retry that stage. */
async function releaseStage(visitorAddress: string, attemptId: string, stage: Stage) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const visitorHash = await sha256Hex(`walkquote-visitor:${visitorAddress}`);
    await supabaseAdmin
      .from("analysis_usage")
      .delete()
      .eq("day", new Date().toISOString().slice(0, 10))
      .eq("visitor_hash", visitorHash)
      .eq("attempt_id", attemptId)
      .eq("stage", stage);
  } catch (error) {
    console.error("analyze-room release failed", { stage, error });
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid = { error: "Invalid request." };

export async function runAnalyzeRoom(body: AnalyzeInput, visitorAddress: string, options: { skipQuota?: boolean } = {}): Promise<Json> {
  const stage = body.stage;
  const sourceId = body.sourceId ?? body.sampleId;
  if (stage === "render") return runRender(body, visitorAddress, options);
  if (stage !== "transcribe" && stage !== "observe" && stage !== "segment") return invalid;
  if (sourceId !== "living" && sourceId !== "bedroom" && sourceId !== "homeowner") return invalid;
  const attemptId = typeof body.attemptId === "string" && UUID.test(body.attemptId) ? body.attemptId.toLowerCase() : null;
  if (!attemptId) return invalid;

  let audio: Uint8Array | null = null;
  let transcript = "";
  let frames: string[] = [];
  try {
    if (stage === "transcribe") {
      if (body.transcript !== undefined || body.frames !== undefined) return invalid;
      audio = validateWavBase64(body.audioBase64);
    } else {
      if (body.audioBase64 !== undefined) return invalid;
      if (stage === "observe" && typeof body.transcript === "string") {
        if (body.transcript.length > 1000) return invalid;
        transcript = redactPrivateStrings(body.transcript);
      }
      if (sourceId === "homeowner") frames = validateRoomFrames(body.frames);
    }
  } catch {
    return stage === "transcribe" ? invalid : { error: "Invalid room images. Add three or four compressed JPEG views and try again." };
  }

  // Guests: 3 estimate runs per visitor per UTC day, 25 site-wide. Each run's stages count once.
  if (!options.skipQuota) {
    const quota = await reserveStage(visitorAddress, attemptId, stage);
    if (quota && isQuotaBlock(quota)) return quota;
  }

  try {
    if (stage === "transcribe") {
      try {
        return { transcript: await transcribe(audio as Uint8Array) };
      } catch (error) {
        if (error instanceof GatewayError && error.code === "SERVICE_UNCONFIGURED") {
          return { error: "The room analysis service is not set up yet. The demo walkthrough still works.", errorCode: "SERVICE_UNCONFIGURED" };
        }
        throw error;
      }
    }
    if (stage === "observe") {
      const imageUrls = sourceId === "homeowner" ? frames : [ROOM_IMAGES[sourceId]];
      return { ...(await observe(imageUrls, transcript, sourceId)) };
    }

    const imageUrl = sourceId === "homeowner" ? frames[Math.floor((frames.length - 1) / 2)] : ROOM_IMAGES[sourceId];
    if (!imageUrl) return invalid;
    if (sourceId !== "homeowner") return { maskText: mergeConceptLines([await samWalls(imageUrl)]) };

    // Walls on every view (color preview per angle), doors and windows on every view
    // (SAM 3.1 cross-checks Muse Spark's counts), trim on the primary view.
    const primaryIndex = Math.floor((frames.length - 1) / 2);
    const perFrameJobs = frames.flatMap((frame) => [
      () => samWalls(frame),
      () => samConcept(frame, "door"),
      () => samConcept(frame, "window"),
    ]);
    const trimJobs = SURFACE_PROMPTS.trim.map((concept) => () => samConcept(frames[primaryIndex], concept));
    const settled = await settleWithLimit<string>([...perFrameJobs, ...trimJobs]);
    const lineAt = (index: number) => {
      const result = settled[index];
      return result.status === "fulfilled" ? result.value : null;
    };
    let remaining = MAX_SEGMENTATION_BUNDLE_CHARS;
    const keep = (value: string | null) => {
      if (!value || value.length > remaining) return null;
      remaining -= value.length;
      return value;
    };
    const wallLine = (i: number) => tryMerge([lineAt(i * 3)]);
    // Primary-frame walls stay aligned with the primary image; other frames act as preview fallbacks.
    const maskText = keep(wallLine(primaryIndex));
    const trimMaskText = keep(tryMerge(trimJobs.map((_, index) => lineAt(perFrameJobs.length + index))));
    const openingMaskText = keep(tryMerge([lineAt(primaryIndex * 3 + 1), lineAt(primaryIndex * 3 + 2)]));
    const frameMaskTexts = frames.map((_, i) => (i === primaryIndex ? maskText : keep(wallLine(i))));
    const countAt = (index: number, kind: "door" | "window") => {
      const result = settled[index];
      return result.status === "fulfilled" ? countSamBoxes(result.value, kind) : null;
    };
    const samDoorCounts = frames.map((_, i) => countAt(i * 3 + 1, "door"));
    const samWindowCounts = frames.map((_, i) => countAt(i * 3 + 2, "window"));
    if (!maskText && !trimMaskText && !openingMaskText && !frameMaskTexts.some(Boolean)) throw new Error("segmentation-unavailable");
    return {
      maskText,
      trimMaskText,
      openingMaskText,
      frameMaskTexts,
      primaryFrameIndex: primaryIndex,
      samDoorCounts,
      samWindowCounts,
      segmentationUnavailable: [
        ...(maskText ? [] : ["walls"]),
        ...(trimMaskText ? [] : ["trim"]),
        ...(openingMaskText ? [] : ["openings"]),
      ],
    };
  } catch (error) {
    console.error("analyze-room stage failed", { stage, sourceId, error });
    if (!options.skipQuota) await releaseStage(visitorAddress, attemptId, stage);
    if (error instanceof GatewayError && error.code) return { error: error.message, errorCode: error.code };
    const message = error instanceof GatewayError ? error.message : "Room analysis did not finish. Please retry.";
    return { error: message };
  }
}

async function runRender(body: AnalyzeInput, visitorAddress: string, options: { skipQuota?: boolean }): Promise<Json> {
  const attemptId = typeof body.attemptId === "string" && UUID.test(body.attemptId) ? body.attemptId.toLowerCase() : null;
  if (!attemptId || body.sourceId !== "homeowner" || body.frames !== undefined || body.audioBase64 !== undefined || body.transcript !== undefined) return invalid;
  const request = validateRenderRequest(body);
  if (!request) return invalid;
  const stage: Stage = `render-${request.renderId}`;
  if (!options.skipQuota) {
    const quota = await reserveStage(visitorAddress, attemptId, stage);
    if (quota && isQuotaBlock(quota)) return quota;
  }
  try {
    return await renderWalls(request.frame, request.colorName, request.colorHex, request.size);
  } catch (error) {
    console.error("analyze-room render failed", { error });
    if (!options.skipQuota) await releaseStage(visitorAddress, attemptId, stage);
    if (error instanceof GatewayError && error.code) return { error: error.message, errorCode: error.code };
    return { error: error instanceof GatewayError ? error.message : "The realistic preview did not finish. Please retry." };
  }
}

// Generated lazily: the Worker runtime forbids random values in global scope.
let processMarker: string | null = null;
function getProcessMarker() {
  processMarker ??= Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  return processMarker;
}

export async function runUsageDiagnostic(address: string | null) {
  let ok = false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("analysis_usage").select("id", { head: true, count: "exact" });
    ok = !error;
  } catch {
    ok = false;
  }
  const connectionFingerprint = address ? (await sha256Hex(`walkquote-diagnostic:${address}`)).slice(0, 24) : null;
  return { ok, processMarker: getProcessMarker(), connectionFingerprint };
}
