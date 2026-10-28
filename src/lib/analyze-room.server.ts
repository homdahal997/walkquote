import {
  MAX_MASK_TEXT_CHARS,
  MAX_SEGMENTATION_BUNDLE_CHARS,
  ROOM_IMAGES,
  SURFACE_PROMPTS,
  buildObservePrompt,
  parseObservationJson,
  redactPrivateStrings,
  validateRoomFrames,
  validateWavBase64,
  type AnalysisSourceId,
  type Stage,
} from "./analyze-room.shared.server";

// Meta Model API (hackathon models): Muse Spark for room review, SAM 3.1 for surface masks,
// Muse Voice Transcribe for spoken notes.
const META_API = "https://api.meta.ai/v1";
const OBSERVE_MODEL = "muse-spark-1.3";
const SEGMENT_MODEL = "sam-3.1";
const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";
const VISITOR_DAILY_LIMIT = 3;
const SITE_DAILY_LIMIT = 25;
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
}

class GatewayError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function apiKey() {
  const key = process.env["META_MODEL_API_KEY"];
  if (!key) throw new GatewayError(503, "The room analysis service is not configured.");
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

function withTimeout(ms = 55_000) {
  return AbortSignal.timeout(ms);
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
  const response = await fetch(`${META_API}/asr/transcribe?sessionId=${crypto.randomUUID()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
    body: form,
    signal: withTimeout(),
  });
  if (!response.ok) await failFromResponse(response);
  const result = (await response.json()) as { transcript?: unknown };
  if (typeof result.transcript !== "string") throw new GatewayError(502, "Room analysis did not finish. Please retry.");
  return redactPrivateStrings(result.transcript);
}

async function observe(imageUrls: string[], transcript: string, sourceId: AnalysisSourceId) {
  const prompt = buildObservePrompt(transcript, sourceId);
  const response = await fetch(`${META_API}/responses`, {
    method: "POST",
    headers: metaHeaders(),
    body: JSON.stringify({
      model: OBSERVE_MODEL,
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: prompt }, ...imageUrls.map((url) => ({ type: "input_image", image_url: url }))],
        },
      ],
    }),
    signal: withTimeout(),
  });
  if (!response.ok) await failFromResponse(response);
  const text = outputText(await response.json());
  if (!text || text.length > 3000) throw new GatewayError(502, "Room analysis did not finish. Please retry.");
  return parseObservationJson(text);
}

/** Runs one SAM 3.1 concept prompt and returns its raw segmentation line (empty when nothing matched). */
async function samConcept(imageUrl: string, concept: string) {
  const response = await fetch(`${META_API}/responses`, {
    method: "POST",
    headers: metaHeaders(),
    body: JSON.stringify({
      model: SEGMENT_MODEL,
      metadata: { mask_encoding: "one_bit" },
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: concept }, { type: "input_image", image_url: imageUrl }] },
      ],
    }),
    signal: withTimeout(),
  });
  if (!response.ok) await failFromResponse(response);
  return outputText(await response.json()).trim();
}

/**
 * Segments one surface type with SAM 3.1. Several concepts are merged into one frame line
 * with re-numbered object ids so the browser decodes it with @meta-sam/parser.
 */
async function segment(imageUrl: string, concepts: readonly string[]) {
  const lines = await Promise.all(concepts.map((concept) => samConcept(imageUrl, concept)));
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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const visitorHash = await sha256Hex(`walkquote-visitor:${visitorAddress}`);
  const day = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabaseAdmin
    .from("analysis_usage")
    .select("attempt_id, visitor_hash")
    .eq("day", day);
  const rows = existing ?? [];
  const isKnownAttempt = rows.some((row) => row.attempt_id === attemptId);
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
    if (error.code === "23505") return { error: "This analysis step was already used. Start a new estimate.", errorCode: "STAGE_ALREADY_USED" };
    throw error;
  }
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid = { error: "Invalid request." };

export async function runAnalyzeRoom(body: AnalyzeInput, visitorAddress: string, options: { skipQuota?: boolean } = {}): Promise<Json> {
  const stage = body.stage;
  const sourceId = body.sourceId ?? body.sampleId;
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
    if (quota) return quota;
  }

  try {
    if (stage === "transcribe") return { transcript: await transcribe(audio as Uint8Array) };
    if (stage === "observe") {
      const imageUrls = sourceId === "homeowner" ? frames : [ROOM_IMAGES[sourceId]];
      return { ...(await observe(imageUrls, transcript, sourceId)) };
    }

    const imageUrl = sourceId === "homeowner" ? frames[Math.floor((frames.length - 1) / 2)] : ROOM_IMAGES[sourceId];
    if (!imageUrl) return invalid;
    if (sourceId !== "homeowner") return { maskText: await segment(imageUrl, SURFACE_PROMPTS.walls) };

    const [wall, trim, opening] = await Promise.allSettled([
      segment(imageUrl, SURFACE_PROMPTS.walls),
      segment(imageUrl, SURFACE_PROMPTS.trim),
      segment(imageUrl, SURFACE_PROMPTS.openings),
    ]);
    let remaining = MAX_SEGMENTATION_BUNDLE_CHARS;
    const keep = (r: PromiseSettledResult<string>) => {
      if (r.status !== "fulfilled" || r.value.length > remaining) return null;
      remaining -= r.value.length;
      return r.value;
    };
    const maskText = keep(wall);
    const trimMaskText = keep(trim);
    const openingMaskText = keep(opening);
    if (!maskText && !trimMaskText && !openingMaskText) throw new Error("segmentation-unavailable");
    return {
      maskText,
      trimMaskText,
      openingMaskText,
      segmentationUnavailable: [
        ...(maskText ? [] : ["walls"]),
        ...(trimMaskText ? [] : ["trim"]),
        ...(openingMaskText ? [] : ["openings"]),
      ],
    };
  } catch (error) {
    console.error("analyze-room stage failed", { stage, sourceId, error });
    const message = error instanceof GatewayError ? error.message : "Room analysis did not finish. Please retry.";
    return { error: message };
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
  return { ok, processMarker: PROCESS_MARKER, connectionFingerprint };
}
