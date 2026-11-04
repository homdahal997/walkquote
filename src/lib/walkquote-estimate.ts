import { decodeMaskToRaster, parseImageStream, recordsOfKind } from "@meta-sam/parser";
import type { ResponsesEvent } from "@meta-sam/parser";
import productTourVideo from "@/assets/walkquote-product-tour.mp4.asset.json";
import type {
  DemoVideoSource,
  EstimateLead,
  MaskData,
  MaskRegion,
  PaintColor,
  RoomAssessment,
  RoomDimensions,
  RoomId,
  ScopeSelections,
} from "@/types/estimate";

export const BRAND_MARK =
  "https://ellprnxjjzatijdxcogk.supabase.co/storage/v1/render/image/public/files/chat-generated-images/project-clduq7bkofnka3ym75h8/d8db62f3-a1e7-423b-a9ca-86c883d2b113.webp?width=96&resize=contain&quality=75";
export const LIVING_ROOM_IMAGE =
  "https://ellprnxjjzatijdxcogk.supabase.co/storage/v1/render/image/public/files/chat-generated-images/project-clduq7bkofnka3ym75h8/1774e3d9-ad86-425c-8924-cce60d1b4eef.webp?width=1200&resize=contain&quality=75";
export const BEDROOM_IMAGE =
  "https://ellprnxjjzatijdxcogk.supabase.co/storage/v1/render/image/public/files/chat-generated-images/project-clduq7bkofnka3ym75h8/6419c099-ff69-4492-8e21-9cd0b046baa2.webp?width=1200&resize=contain&quality=75";
export const VIDEO_CARD_IMAGE = LIVING_ROOM_IMAGE.replace("width=1200", "width=600");

export const DEMO_TRANSCRIPT = "Paint the blue walls in a warm linen color, two coats, fix that drywall crack over the door, and don’t paint the ceiling.";

// Leave empty until WalkQuote has a real demo video. Accepts an HTTPS MP4, YouTube URL, or Loom URL.
export const DEMO_VIDEO_SOURCE = "";

export const DEMO_COLORS = [
  { name: "Warm Linen", hex: "#EADCC4" },
  { name: "Sage Green", hex: "#969B80" },
  { name: "Coastal Gray", hex: "#B7CDD0" },
  { name: "Modern Navy", hex: "#304657" },
] as const;

export const DEMO_SPATIAL_MATH = {
  grossWallArea: 420,
  openingDeductionSqFt: 48,
  wallArea: 372,
  ceilingHeightFt: 8,
  doorHeightInches: 80,
  scalePixelsPerInch: 5.2,
  wallPlaneArea: 148,
  doorCount: 1,
  windowCount: 2,
  windowWidthInches: 36,
  windowHeightInches: 48,
  windowDeductionSqFt: 12,
  crackLengthInches: 8,
} as const;

export const DEMO_WALL_MASK_PATH = [
  "M 0 78 L 1287 78 L 1287 706 L 0 706 Z",
  "M 76 172 H 332 V 546 H 76 Z",
  "M 373 172 H 629 V 546 H 373 Z",
  "M 946 171 H 1228 V 747 H 946 Z",
].join(" ");
export const DEMO_WALL_TINT_PATH = `${DEMO_WALL_MASK_PATH} M 654 307 H 790 V 398 H 654 Z`;
export const DEMO_WALL_OUTLINE_PATH = "M 0 78 L 1287 78 L 1287 706 L 0 706 Z";
export const DEMO_BEDROOM_WALL_MASK_PATH = [
  "M 0 88 L 772 137 L 1400 70 L 1400 610 L 0 610 Z",
  "M 0 135 L 171 148 L 171 530 L 0 526 Z",
  "M 242 396 L 1035 399 L 1186 610 L 220 610 Z",
].join(" ");
export const DEMO_BEDROOM_WALL_OUTLINE_PATH = "M 0 88 L 772 137 L 1400 70 L 1400 610 L 0 610 Z";

export const ROOMS = {
  living: {
    id: "living" as const,
    name: "Living room",
    descriptor: "Deep-blue walls with two windows, a doorway, and a small drywall crack",
    image: LIVING_ROOM_IMAGE,
    alt: "Generated illustrative living room with deep-blue walls, two windows, a standard interior doorway, and a small hairline crack",
    dimensions: "15 × 18 ft · 8 ft ceiling",
    lengthFt: 15,
    widthFt: 18,
    ceilingHeightFt: 8,
    grossWallArea: DEMO_SPATIAL_MATH.grossWallArea,
    openingDeductionSqFt: DEMO_SPATIAL_MATH.openingDeductionSqFt,
    wallArea: DEMO_SPATIAL_MATH.wallArea,
    ceilingArea: 270,
    trimLength: 66,
    doorSides: 2,
    patchCount: 1,
    darkWalls: true,
    visualClue: "A small hairline crack is visible just left of the doorway.",
    spokenCue: DEMO_TRANSCRIPT,
    caution: "The sample crack is a visual clue only. A painter should confirm the surface before repair.",
  },
  bedroom: {
    id: "bedroom" as const,
    name: "Bedroom",
    descriptor: "Worn trim with a faint ceiling discoloration",
    image: BEDROOM_IMAGE,
    alt: "Generated demo bedroom with pale walls, worn baseboard trim, and a faint ceiling mark",
    dimensions: "12 × 14 ft · 8 ft ceiling",
    lengthFt: 12,
    widthFt: 14,
    ceilingHeightFt: 8,
    grossWallArea: 350,
    openingDeductionSqFt: null,
    wallArea: 350,
    ceilingArea: 168,
    trimLength: 52,
    doorSides: 1,
    patchCount: 0,
    darkWalls: false,
    visualClue: "Trim wear and a faint ceiling mark are visible.",
    spokenCue: "I would like the bedroom walls refreshed and the worn trim painted.",
    caution: "The ceiling mark is not a diagnosis. Confirm its cause before painting over it.",
  },
} as const;

export function resolveDemoVideoSource(rawSource: string): DemoVideoSource | null {
  const source = rawSource.trim();
  if (!source) return null;

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (/\.(?:mp4|m4v|webm)$/i.test(url.pathname)) return { kind: "video", src: url.href };

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let youtubeId = "";
  if (host === "youtu.be") youtubeId = parts[0] ?? "";
  if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
    youtubeId = parts[0] === "watch" ? url.searchParams.get("v") ?? "" : ["embed", "shorts", "live"].includes(parts[0] ?? "") ? parts[1] ?? "" : "";
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
    return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0` };
  }

  if (host === "loom.com") {
    const loomMatch = url.pathname.match(/^\/(?:share|embed)\/([A-Za-z0-9]+)\/?$/);
    if (loomMatch) return { kind: "embed", src: `https://www.loom.com/embed/${loomMatch[1]}` };
  }

  return null;
}

export const DEMO_VIDEO: DemoVideoSource | null =
  resolveDemoVideoSource(DEMO_VIDEO_SOURCE) ?? { kind: "video", src: productTourVideo.url };
export const DEMO_SCOPE_SELECTIONS: Record<RoomId, ScopeSelections> = {
  living: { ceiling: false, trim: false, doors: false, patch: true },
  bedroom: { ceiling: false, trim: true, doors: false, patch: false },
};

export function demoMeasurementFields(roomId: RoomId) {
  const room = ROOMS[roomId];
  return {
    lengthFt: String(room.lengthFt),
    widthFt: String(room.widthFt),
    perimeterFt: String(room.trimLength),
    ceilingAreaSqFt: String(room.ceilingArea),
    ceilingHeightFt: String(room.ceilingHeightFt),
    doorSides: String(room.doorSides),
    patchCount: String(room.patchCount),
  };
}

export const COLORS = [
  { name: "Warm Linen", hex: "#eadcc4" },
  { name: "Sage & Olive", hex: "#969b80" },
  { name: "Coastal Fog", hex: "#b7cdd0" },
  { name: "Hale Navy", hex: "#304657" },
] as const;

export const BUDGET_CHOICES = [
  { label: "$500", value: 500 },
  { label: "$1,000", value: 1000 },
  { label: "$1,500", value: 1500 },
  { label: "$2,500+", value: 2500 },
  { label: "Show market price", value: null },
] as const;

export function formatDimensionValue(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

export function roomDimensionsLabel(measurements: RoomDimensions) {
  if (measurements.grossWallArea === undefined) {
    return `Approximate net wall area · ${formatDimensionValue(measurements.wallArea)} sq ft · homeowner-entered approximation`;
  }
  if (measurements.roomShape === "square_footage_approximation") {
    if (measurements.ceilingArea === undefined) return "Custom floor area not recorded";
    const side = Math.sqrt(measurements.ceilingArea);
    return `Custom floor area · ${formatDimensionValue(measurements.ceilingArea)} sq ft · square-ish footprint ≈ ${formatDimensionValue(side)} × ${formatDimensionValue(side)} ft`;
  }
  if (measurements.roomShape === "irregular_open_plan") {
    const parts = ["Irregular / open-plan"];
    if (typeof measurements.perimeterFt === "number") parts.push(`${formatDimensionValue(measurements.perimeterFt)} ft perimeter`);
    if (typeof measurements.ceilingArea === "number") parts.push(`${formatDimensionValue(measurements.ceilingArea)} sq ft ceiling`);
    if (typeof measurements.ceilingHeightFt === "number") parts.push(`${formatDimensionValue(measurements.ceilingHeightFt)} ft ceiling height`);
    return parts.join(" · ");
  }
  const parts = ["Approx. rectangular footprint"];
  if (typeof measurements.lengthFt === "number" && typeof measurements.widthFt === "number") {
    parts.push(`${formatDimensionValue(measurements.lengthFt)} × ${formatDimensionValue(measurements.widthFt)} ft`);
  }
  if (typeof measurements.ceilingHeightFt === "number") parts.push(`${formatDimensionValue(measurements.ceilingHeightFt)} ft ceiling`);
  return parts.join(" · ");
}

export function measurementSourceLabel(source: string | undefined, mode?: string) {
  if (mode === "demo" || source === "sample_preset" || source === "demo") return "Illustrative sample preset";
  if (!source) return "Source not recorded";
  if (/homeowner_entered_net_wall_area/i.test(source)) return "Homeowner-entered net wall-area approximation";
  if (/doorway|door_scale|standard_door/i.test(source)) return "Doorway-scale estimate";
  if (/custom.*floor|floor.*custom/i.test(source)) return "Custom floor-area approximation";
  if (/room_size_preset|preset/i.test(source)) return "Room-size preset with assumed 8-ft ceiling";
  if (/homeowner_(entered|confirmed)/i.test(source)) return "Older homeowner-entered dimensions";
  return "Source not recorded";
}

export function roomMeasurementSummary(lead: EstimateLead) {
  if (lead.estimate_mode === "demo") return lead.sample_dimensions || "Sample-room quantities";
  if (lead.measurement_source === "homeowner_entered_net_wall_area" && typeof lead.wall_area_sqft === "number") {
    return `Homeowner-entered approximate net wall area · ${formatDimensionValue(lead.wall_area_sqft)} sq ft`;
  }
  const perimeter = typeof lead.room_perimeter_ft === "number" ? lead.room_perimeter_ft : lead.trim_length_ft;
  if (lead.room_shape === "square_footage_approximation") {
    const floorArea = typeof lead.ceiling_area_sqft === "number" ? lead.ceiling_area_sqft : null;
    const parts = [typeof floorArea === "number" ? `Custom floor area · ${formatDimensionValue(floorArea)} sq ft` : "Custom floor-area estimate", "square-ish footprint"];
    if (typeof perimeter === "number") parts.push(`${formatDimensionValue(perimeter)} ft estimated perimeter`);
    if (typeof lead.ceiling_height_ft === "number") parts.push(`${formatDimensionValue(lead.ceiling_height_ft)} ft assumed ceiling`);
    return parts.join(" · ");
  }
  if (lead.room_shape === "irregular_open_plan" || (typeof lead.room_length_ft !== "number" && typeof perimeter === "number")) {
    const parts = ["Irregular / open-plan"];
    if (typeof perimeter === "number") parts.push(`${formatDimensionValue(perimeter)} ft perimeter`);
    if (typeof lead.ceiling_area_sqft === "number") parts.push(`${formatDimensionValue(lead.ceiling_area_sqft)} sq ft ceiling`);
    if (typeof lead.ceiling_height_ft === "number") parts.push(`${formatDimensionValue(lead.ceiling_height_ft)} ft ceiling height`);
    return parts.length > 1 ? parts.join(" · ") : lead.sample_dimensions || "Not provided";
  }
  if (typeof lead.room_length_ft === "number" && typeof lead.room_width_ft === "number") {
    const parts = ["Rectangular", `${formatDimensionValue(lead.room_length_ft)} × ${formatDimensionValue(lead.room_width_ft)} ft`];
    if (typeof lead.ceiling_height_ft === "number") parts.push(`${formatDimensionValue(lead.ceiling_height_ft)} ft ceiling`);
    return parts.join(" · ");
  }
  return lead.sample_dimensions || "Not provided";
}

export function colorFromHex(hex: string): PaintColor {
  const normalized = hex.toUpperCase();
  const preset = COLORS.find((choice) => choice.hex.toUpperCase() === normalized);
  return preset ? { name: preset.name, hex: normalized } : { name: "Custom shade", hex: normalized };
}

export function clampCount(value: unknown, max = 20): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) return null;
  return Math.round(value);
}

export function clampArea(value: unknown, max = 600): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > max) return null;
  return Math.round(value * 10) / 10;
}

export function hasDoorScopeCue(note: string) {
  return /\b(?:doors?|doorways?|door[\s-]?frames?)\b/i.test(note);
}

export function hasPatchScopeCue(note: string) {
  return /\b(?:patch(?:es)?|repairs?|cracks?|dents?|holes?|marks?|stains?|blemishes?)\b/i.test(note);
}

export function hasOptionalScopeCue(assessment: RoomAssessment, note: string) {
  return (assessment.visibleDoorCount ?? 0) > 0 || (assessment.visibleMarkCount ?? 0) > 0 || hasDoorScopeCue(note) || hasPatchScopeCue(note);
}

export function cleanRoomNote(value: string) {
  return value
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email omitted]")
    .replace(/\b(?:\+?1[\s().-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, "[phone omitted]")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, "[number omitted]")
    .replace(/\b\d{1,6}\s+(?:[A-Za-z0-9.'#-]+\s+){0,5}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|way|parkway|pkwy|place|pl|circle|cir|terrace|ter)\b[^,.;]*/gi, "[address omitted]")
    .replace(/\bmy name(?:\s+is|'s)\s+[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)?/gi, "[name omitted]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

function encodeBytesBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function decodeBase64Bytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function* replayMaskOutput(rawText: string): AsyncGenerator<ResponsesEvent> {
  const lane = { item_id: "sam-wall-mask", output_index: 0, content_index: 0 };
  yield { type: "response.output_text.delta", delta: rawText, ...lane };
  yield { type: "response.output_text.done", text: rawText, ...lane };
  yield { type: "response.completed" };
}

async function decodeWallMask(rawText: string): Promise<MaskData> {
  if (typeof rawText !== "string" || rawText.length < 20 || rawText.length > 1_800_000) {
    throw new Error("mask-output-invalid");
  }
  const parsed = await parseImageStream(replayMaskOutput(rawText)).finalResult;
  if (parsed.outcome.status !== "completed") throw new Error("mask-output-incomplete");
  const masks = recordsOfKind(parsed.records, "mask");
  const boxes = recordsOfKind(parsed.records, "box");
  if (masks.length === 0 || masks.length > 16) throw new Error("mask-region-count");

  const boxToken = rawText.match(/<\|box;([^|]+)\|>/);
  if (!boxToken) throw new Error("mask-source-size-missing");
  const boxFields = Object.fromEntries(
    boxToken[1].split(";").map((part) => {
      const separator = part.indexOf("=");
      return separator < 0
        ? [part.trim(), ""]
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }),
  );
  const width = Number(boxFields.w);
  const height = Number(boxFields.h);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 3000 || height > 3000 || width * height > 4_000_000) {
    throw new Error("mask-source-size-invalid");
  }

  const combined = new Uint8Array(width * height);
  const regions: MaskRegion[] = [];
  let matchedMasks = 0;
  for (const maskRecord of masks) {
    const box = boxes.find((candidate) => candidate.objectId === maskRecord.objectId);
    if (!box) continue;
    const raster = decodeMaskToRaster(maskRecord.mask);
    const maskWidth = maskRecord.mask.width;
    const maskHeight = maskRecord.mask.height;
    const bounds = maskRecord.bounds;
    const boxWidth = bounds.right - bounds.left;
    const boxHeight = bounds.bottom - bounds.top;
    if (maskWidth < 1 || maskHeight < 1 || boxWidth < 1 || boxHeight < 1 || bounds.left < 0 || bounds.top < 0 || bounds.right > width || bounds.bottom > height || raster.length !== maskWidth * maskHeight) continue;

    matchedMasks += 1;
    if (regions.length < 12) regions.push({ left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom });
    for (let y = 0; y < maskHeight; y += 1) {
      const targetY = Math.min(height - 1, bounds.top + Math.floor(((y + 0.5) * boxHeight) / maskHeight));
      for (let x = 0; x < maskWidth; x += 1) {
        if (raster[y * maskWidth + x] !== 1) continue;
        const targetX = Math.min(width - 1, bounds.left + Math.floor(((x + 0.5) * boxWidth) / maskWidth));
        combined[targetY * width + targetX] = 1;
      }
    }
  }
  if (matchedMasks === 0 || !combined.some((pixel) => pixel === 1)) throw new Error("wall-mask-empty");

  const packed = new Uint8Array(Math.ceil(combined.length / 8));
  for (let index = 0; index < combined.length; index += 1) {
    if (combined[index] === 1) packed[index >> 3] |= 1 << (7 - (index & 7));
  }
  return { width, height, dataBase64: encodeBytesBase64(packed), regions };
}

export async function decodeOptionalMask(value: unknown): Promise<MaskData | null> {
  if (typeof value !== "string" || value.length < 20) return null;
  try {
    return await decodeWallMask(value);
  } catch {
    return null;
  }
}

export class AnalysisStageError extends Error {
  constructor(message: string, readonly code?: string, readonly resetsAt?: string) {
    super(message);
    this.name = "AnalysisStageError";
  }
}

export function formatLimitResetTime(value?: string) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp)) return "after the daily reset";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}
