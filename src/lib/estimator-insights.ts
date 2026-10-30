import type { RoomAssessment, ScopeLine, SurfaceIssue } from "@/types/estimate";

export const COVERAGE_SQFT_PER_GALLON = 350;
const DOOR_SIDE_SQFT = 21;

const NUMBER_WORDS: Record<string, number> = { no: 0, zero: 0, one: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const COUNT_TOKEN = "(\\d{1,2}|no|zero|one|single|two|three|four|five|six|seven|eight|nine|ten)";

/** Count the homeowner said aloud for a noun ("two closet doors", "3 windows"); null when not said. */
export function spokenCount(note: string, noun: "door" | "window"): number | null {
  const match = note.toLowerCase().match(new RegExp(`\\b${COUNT_TOKEN}\\s+(?:[a-z]+\\s+)?${noun}s?\\b`));
  if (!match) return null;
  const token = match[1];
  return /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token] ?? null;
}

const NEGATION = "(?:don'?t|do not|no|skip|without|not|leave|exclude|except)";

/** Spoken scope intent for a surface: include, exclude, or nothing said. */
export function spokenIntent(note: string, surface: "ceiling" | "trim" | "doors"): "include" | "exclude" | null {
  const lowered = note.toLowerCase();
  const noun = surface === "ceiling" ? "ceilings?" : surface === "trim" ? "(?:trim|baseboards?|molding|moulding)" : "(?:doors?|door frames?)";
  if (!new RegExp(`\\b${noun}\\b`).test(lowered)) return null;
  const excluded = new RegExp(`\\b${NEGATION}\\b[^.,;]{0,30}\\b${noun}\\b`).test(lowered)
    || new RegExp(`\\b${noun}\\b[^.,;]{0,20}\\b(?:is fine|are fine|stays?|as is|is ok|are ok|alone)\\b`).test(lowered);
  return excluded ? "exclude" : "include";
}

const maxCount = (counts: Array<number | null> | undefined) => {
  const seen = (counts ?? []).filter((count): count is number => typeof count === "number");
  return seen.length ? Math.max(...seen) : null;
};

export interface VoiceVisionCheck {
  id: string;
  topic: string;
  status: "match" | "conflict" | "intent";
  message: string;
}

export interface SamCounts {
  doors?: Array<number | null>;
  windows?: Array<number | null>;
}

function countCheck(noun: "door" | "window", said: number | null, muse: number | null, sam: number | null): VoiceVisionCheck | null {
  if (said === null || (muse === null && sam === null)) return null;
  const plural = (count: number) => `${count} ${noun}${count === 1 ? "" : "s"}`;
  const seen = [muse !== null ? `Muse Spark saw ${muse}` : null, sam !== null ? `SAM 3.1 outlined ${sam} in one view` : null].filter(Boolean).join(" · ");
  const agrees = said === muse || said === sam;
  return {
    id: `${noun}s`,
    topic: noun === "door" ? "Doors" : "Windows",
    status: agrees ? "match" : "conflict",
    message: agrees
      ? `You said ${plural(said)} · ${seen} · voice and camera agree`
      : `You said ${plural(said)} · ${seen} · confirm on site`,
  };
}

/** Compares what Muse Voice heard with what Muse Spark and SAM 3.1 saw. */
export function reconcileVoiceVision(note: string, assessment: RoomAssessment | null | undefined, sam: SamCounts = {}): VoiceVisionCheck[] {
  if (!note.trim() || !assessment) return [];
  const checks: VoiceVisionCheck[] = [];
  const doors = countCheck("door", spokenCount(note, "door"), assessment.visibleDoorCount, maxCount(sam.doors));
  const windows = countCheck("window", spokenCount(note, "window"), assessment.visibleWindowCount, maxCount(sam.windows));
  if (doors) checks.push(doors);
  if (windows) checks.push(windows);
  const issues = assessment.surfaceConditions?.issues ?? [];
  const ceiling = spokenIntent(note, "ceiling");
  if (ceiling === "exclude") {
    checks.push(issues.includes("water_stains")
      ? { id: "ceiling", topic: "Ceiling", status: "conflict", message: "You asked to skip the ceiling · Muse Spark noted water stains · stains can bleed through, confirm on site" }
      : { id: "ceiling", topic: "Ceiling", status: "intent", message: "You asked to skip the ceiling · removed from the default scope" });
  } else if (ceiling === "include") {
    checks.push({ id: "ceiling", topic: "Ceiling", status: "intent", message: "You asked for the ceiling · added to the default scope" });
  }
  const trim = spokenIntent(note, "trim");
  if (trim) checks.push({ id: "trim", topic: "Trim", status: "intent", message: trim === "exclude" ? "You asked to skip trim · removed from the default scope" : "You asked for trim · added to the default scope" });
  if (/\baccent wall\b/i.test(note)) checks.push({ id: "accent", topic: "Accent wall", status: "intent", message: "You mentioned an accent wall · price assumes one wall color, confirm which wall on site" });
  if (/\b(one|single|1)\s+coat\b/i.test(note)) checks.push({ id: "coats", topic: "Coats", status: "conflict", message: "You asked for one coat · estimate keeps two coats for even, warrantable coverage" });
  return checks;
}

/** True when the homeowner's spoken door count disagrees with both Muse Spark and SAM 3.1. */
export function doorCountConflict(note: string, assessment: RoomAssessment | null | undefined, samDoorCounts?: Array<number | null>) {
  return reconcileVoiceVision(note, assessment, { doors: samDoorCounts }).some((check) => check.id === "doors" && check.status === "conflict");
}

export interface MaterialLine {
  id: string;
  surface: string;
  product: string;
  sheen: string;
  coats: number;
  areaSqFt: number;
  gallons: number;
  buy: string;
}

export interface PrimerNeed {
  product: string;
  buy: string;
  reason: string;
}

export interface MaterialsTakeoff {
  lines: MaterialLine[];
  primer: PrimerNeed[];
  primerRequired: boolean;
  totalGallons: number;
}

const quarter = (value: number) => Math.ceil(value * 4) / 4;
const buyLabel = (gallons: number) => gallons <= 0.75 ? `${Math.max(1, Math.round(gallons * 4))} qt` : `${Math.ceil(gallons)} gal`;

function paint(id: string, surface: string, product: string, sheen: string, areaSqFt: number, factor = 1, coats = 2): MaterialLine {
  const gallons = quarter((areaSqFt * coats * factor) / COVERAGE_SQFT_PER_GALLON);
  return { id, surface, product, sheen, coats, areaSqFt: Math.round(areaSqFt), gallons, buy: buyLabel(gallons) };
}

const SPOT_PRIMERS: Partial<Record<SurfaceIssue, PrimerNeed>> = {
  water_stains: { product: "Stain-blocking primer (spot)", buy: "1 qt", reason: "Muse Spark saw water stains; they bleed through latex without a blocker" },
  peeling: { product: "Bonding primer (scraped areas)", buy: "1 qt", reason: "Peeling paint is scraped, sanded and primed before topcoat" },
  mildew: { product: "Mildew wash + mildew-resistant primer (spot)", buy: "1 qt", reason: "Mildew must be killed and sealed before painting" },
};

/** Paint and primer takeoff from the included lines: 350 sq ft per gallon per coat. */
export function materialsTakeoff(includedLines: ScopeLine[], assessment?: RoomAssessment | null): MaterialsTakeoff {
  const features = assessment?.architecturalFeatures ?? null;
  const wetRoom = /bath|kitchen|laundry/i.test(assessment?.roomType ?? "");
  const byId = new Map(includedLines.map((line) => [line.id, line]));
  const lines: MaterialLine[] = [];
  const walls = byId.get("walls");
  if (walls) lines.push(paint("walls", "Walls", "Premium interior latex", wetRoom ? "Satin" : "Eggshell", walls.quantity, features?.wallTexture === "textured" ? 1.15 : 1));
  const ceiling = byId.get("ceiling");
  if (ceiling) lines.push(paint("ceiling", "Ceiling", "Ceiling latex", "Flat", ceiling.quantity, features?.ceilingType === "textured" ? 1.25 : 1));
  const trim = byId.get("trim");
  const crown = byId.get("crown");
  const trimArea = (trim ? trim.quantity * (features?.baseboardStyle === "tall_decorative" ? 0.5 : 0.33) : 0) + (crown ? crown.quantity * 0.4 : 0);
  const doors = byId.get("doors");
  const doorArea = doors ? doors.quantity * DOOR_SIDE_SQFT : 0;
  if (trimArea + doorArea > 0) {
    const surfaces = [trim ? "baseboards" : null, crown ? "crown" : null, doors ? "doors & frames" : null].filter(Boolean).join(", ");
    lines.push(paint("trim", `Trim (${surfaces})`, "Trim & door enamel", "Semi-gloss", trimArea + doorArea));
  }
  const primer: PrimerNeed[] = [];
  const fullPrimer = byId.get("primer");
  if (fullPrimer) {
    const gallons = quarter(fullPrimer.quantity / 300);
    primer.push({ product: "High-hide primer (full walls)", buy: buyLabel(gallons), reason: "Dark existing walls under a lighter color" });
  }
  for (const issue of assessment?.surfaceConditions?.issues ?? []) {
    const need = SPOT_PRIMERS[issue];
    if (need) primer.push(need);
  }
  if (byId.has("patch") && !primer.some((need) => need.product.includes("spot"))) {
    primer.push({ product: "Spot primer for patched areas", buy: "1 qt", reason: "Fresh patch compound flashes through paint unless primed" });
  }
  return {
    lines,
    primer,
    primerRequired: primer.length > 0,
    totalGallons: Math.round(lines.reduce((sum, line) => sum + line.gallons, 0) * 100) / 100,
  };
}

export const LEAD_SAFE_NOTE = "Lead-safe check: if the home was built before 1978, test painted surfaces for lead before any sanding or scraping (EPA RRP rule).";

const ISSUE_NAMES: Record<SurfaceIssue, string> = { peeling: "Peeling paint", water_stains: "Water stains", cracks: "Cracks", mildew: "Mildew" };

/** Everything the painter should verify in person, in plain words. */
export function siteChecks(assessment: RoomAssessment | null | undefined, includedLines: ScopeLine[], voice: VoiceVisionCheck[]): string[] {
  const conditions = assessment?.surfaceConditions;
  return [
    ...(conditions?.issues ?? []).map((issue) => `${ISSUE_NAMES[issue]} seen by Muse Spark 1.3`),
    ...(conditions?.leadPaintCaution ? [LEAD_SAFE_NOTE] : []),
    ...includedLines.filter((line) => line.confidence === "confirm_on_site").map((line) => `Confirm on site · ${line.label}: ${line.confidenceNote}`),
    ...voice.filter((check) => check.status === "conflict").map((check) => `Voice vs vision · ${check.message}`),
  ];
}

/** One-line materials summary for the quote document. */
export function materialsSummary(takeoff: MaterialsTakeoff): string[] {
  return [
    ...takeoff.lines.map((line) => `${line.surface}: ${line.product}, ${line.sheen.toLowerCase()} · ${line.coats} coats · ~${line.gallons} gal (buy ${line.buy})`),
    takeoff.primerRequired ? `Primer: ${takeoff.primer.map((need) => `${need.product} (${need.buy})`).join("; ")}` : "Primer: not required over sound, previously painted surfaces",
  ];
}
