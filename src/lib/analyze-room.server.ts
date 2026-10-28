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

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const OBSERVE_MODEL = "openai/gpt-6-astra";
// Gemini returns reliable 0-1000 spatial coordinates, which the wall/trim/opening overlays need.
const SEGMENT_MODEL = "google/gemini-3-flash-preview";
const TRANSCRIBE_MODEL = "openai/gpt-transcribe";
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
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new GatewayError(503, "The room analysis service is not configured.");
  return key;
}

function gatewayHeaders(sdk = "fetch") {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Lovable-API-Key": apiKey(),
    "X-Lovable-AIG-SDK": sdk,
    "Content-Type": "application/json",
  };
}

async function failFromResponse(response: Response): Promise<never> {
  const body = await response.text().catch(() => "");
  console.error("analyze-room gateway error", response.status, body.slice(0, 500));
  if (response.status === 429) throw new GatewayError(429, "The analysis service is busy right now. Wait a minute and retry.");
  if (response.status === 402) throw new GatewayError(402, "Room analysis is paused because AI credits ran out. Please try again later.");
  throw new GatewayError(response.status, "Room analysis did not finish. Please retry.");
}

async function* sseData(response: Response): AsyncGenerator<Json> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        yield JSON.parse(data) as Json;
      } catch {
        /* ignore partial frames */
      }
    }
  }
}

/** Streams a Responses call and returns the final text. */
async function responsesText(content: Json[]) {
  const response = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({
      model: OBSERVE_MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      input: [{ role: "user", content }],
    }),
  });
  if (!response.ok) await failFromResponse(response);
  let text = "";
  for await (const event of sseData(response)) {
    if (event["type"] === "response.output_text.delta" && typeof event["delta"] === "string") text += event["delta"];
    if (event["type"] === "response.failed" || event["type"] === "error") throw new GatewayError(502, "Room analysis did not finish. Please retry.");
  }
  return text;
}

/** Streams a chat completion and returns the final text. */
async function chatText(messages: Json[]) {
  const response = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({ model: SEGMENT_MODEL, stream: true, messages }),
  });
  if (!response.ok) await failFromResponse(response);
  let text = "";
  for await (const event of sseData(response)) {
    const choices = event["choices"] as Array<{ delta?: { content?: string } }> | undefined;
    const delta = choices?.[0]?.delta?.content;
    if (typeof delta === "string") text += delta;
  }
  return text;
}

async function transcribe(bytes: Uint8Array) {
  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("file", new File([bytes], "room-note.wav", { type: "audio/wav" }));
  form.append("response_format", "json");
  const response = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Lovable-API-Key": apiKey(), "X-Lovable-AIG-SDK": "fetch" },
    body: form,
  });
  if (!response.ok) await failFromResponse(response);
  const result = (await response.json()) as { text?: unknown; transcript?: unknown };
  const text = typeof result.text === "string" ? result.text : typeof result.transcript === "string" ? result.transcript : null;
  if (text === null) throw new GatewayError(502, "Room analysis did not finish. Please retry.");
  return redactPrivateStrings(text);
}

async function observe(imageUrls: string[], transcript: string, sourceId: AnalysisSourceId) {
  const prompt = buildObservePrompt(transcript, sourceId);
  const text = await responsesText([
    { type: "input_text", text: prompt },
    ...imageUrls.map((url) => ({ type: "input_image", image_url: url })),
  ]);
  if (!text || text.length > 3000) throw new GatewayError(502, "Room analysis did not finish. Please retry.");
  return parseObservationJson(text);
}

function jpegSize(dataUrl: string): { width: number; height: number } | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const binary = atob(dataUrl.slice(comma + 1));
  let offset = 2;
  while (offset + 9 < binary.length) {
    if (binary.charCodeAt(offset) !== 0xff) return null;
    const marker = binary.charCodeAt(offset + 1);
    const length = (binary.charCodeAt(offset + 2) << 8) | binary.charCodeAt(offset + 3);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (binary.charCodeAt(offset + 5) << 8) | binary.charCodeAt(offset + 6);
      const width = (binary.charCodeAt(offset + 7) << 8) | binary.charCodeAt(offset + 8);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += 2 + length;
  }
  return null;
}

async function imageSize(url: string) {
  if (url.startsWith("data:image/jpeg")) return jpegSize(url) ?? { width: 1200, height: 800 };
  return { width: 1200, height: 800 };
}

/**
 * Asks the vision model for polygon outlines of one surface type and returns a compact JSON
 * mask description that the browser rasterizes (see decodeOptionalMask).
 */
async function segment(imageUrl: string, surfacePrompt: string) {
  const size = await imageSize(imageUrl);
  const text = await chatText([
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `${surfacePrompt}\nReturn only JSON: {"polygons": [[[x, y], ...], ...]} with up to 12 polygons outlining the requested surfaces. Coordinates are integers normalized 0-1000 (x across the image width, y down the image height). Each polygon needs 3 to 40 points. Return {"polygons": []} if none are visible.`,
        },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ]);
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("segmentation-invalid");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { polygons?: unknown };
  if (!Array.isArray(parsed.polygons)) throw new Error("segmentation-invalid");
  const polygons = parsed.polygons
    .filter((poly): poly is unknown[] => Array.isArray(poly))
    .map((poly) =>
      poly
        .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2 && typeof p[0] === "number" && typeof p[1] === "number")
        .slice(0, 40)
        .map(([x, y]) => [Math.round(Math.min(1000, Math.max(0, x))), Math.round(Math.min(1000, Math.max(0, y)))]),
    )
    .filter((poly) => poly.length >= 3)
    .slice(0, 12);
  if (polygons.length === 0) throw new Error("segmentation-empty");
  const out = JSON.stringify({ v: "poly", w: size.width, h: size.height, polygons });
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

export async function runAnalyzeRoom(body: AnalyzeInput, visitorAddress: string): Promise<Json> {
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

  const quota = await reserveStage(visitorAddress, attemptId, stage);
  if (quota) return quota;

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
