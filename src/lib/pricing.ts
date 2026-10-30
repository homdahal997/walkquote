import type { ArchitecturalFeatures, EvidenceBadge, PaintColor, QuoteTotals, RoomAssessment, RoomDimensions, ScopeId, ScopeLine, ScopeSelections, SurfaceIssue, WallTone } from "@/types/estimate";
import { doorCountConflict, spokenIntent } from "@/lib/estimator-insights";

export const PRICE_BOOK = {
  walls: {
    rateLow: 2,
    rateHigh: 2.5,
    detailRateLabel: "$2.00–$2.50 per sq ft",
    summaryRateLabel: "$2.00–$2.50 / sq ft",
  },
  ceiling: {
    rateLow: 1.5,
    rateHigh: 1.8,
    detailRateLabel: "$1.50–$1.80 per sq ft",
    summaryRateLabel: "$1.50–$1.80 / sq ft",
  },
  trim: {
    rateLow: 4,
    rateHigh: 5,
    detailRateLabel: "$4.00–$5.00 per linear ft",
    summaryRateLabel: "$4.00–$5.00 / ft",
  },
  crown: {
    rateLow: 3.5,
    rateHigh: 5,
    detailRateLabel: "$3.50–$5.00 per linear ft",
    summaryRateLabel: "$3.50–$5.00 / ft",
  },
  doors: {
    rateLow: 45,
    rateHigh: 65,
    detailRateLabel: "$45–$65 per side",
    summaryRateLabel: "$45–$65",
  },
  patch: {
    rateLow: 60,
    rateHigh: 90,
    detailRateLabel: "$60–$90 each",
    summaryRateLabel: "$60–$90",
  },
  repair: {
    rateLow: 75,
    rateHigh: 175,
    detailRateLabel: "$75–$175 per condition",
    summaryRateLabel: "$75–$175",
  },
  primer: {
    rate: 0.5,
    detailRateLabel: "+$0.50 per sq ft",
    summaryRateLabel: "+$0.50 / sq ft",
    darkWallReferenceHex: "#304657",
  },
  taxAndConsumables: {
    rate: 0.085,
    label: "8.5%",
  },
} as const;

export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function moneyRange(low: number, high: number) {
  return `${money(low)}–${money(high)}`;
}

function lightnessFromHex(hex: string) {
  const channels = hex.replace(/^#/, "").match(/.{2}/g);
  if (!channels || channels.length !== 3) return 0;
  const [red, green, blue] = channels.map((channel) => parseInt(channel, 16));
  return (Math.max(red, green, blue) + Math.min(red, green, blue)) / (2 * 255);
}

export function itemIsIncluded(item: ScopeLine, selection: ScopeSelections) {
  if (item.required) return true;
  return selection[item.id] ?? item.defaultIncluded;
}

export function buildScopeLines(
  measurements: RoomDimensions,
  color: PaintColor,
  wallTone: WallTone,
  note: string,
  mode: "homeowner" | "demo",
  assessment?: RoomAssessment | null,
  evidence: ScopeEvidenceOptions = {},
): ScopeLine[] {
  const lowered = note.toLowerCase();
  const ceilingIntent = spokenIntent(note, "ceiling");
  const features = assessment?.architecturalFeatures ?? null;
  const lines: ScopeLine[] = [
    {
      id: "walls",
      label: "Wall painting · two coats",
      detail: `${Math.round(measurements.wallArea)} sq ft · premium latex · ${PRICE_BOOK.walls.detailRateLabel}`,
      quantity: measurements.wallArea,
      unit: "sq ft",
      rateLow: PRICE_BOOK.walls.rateLow,
      rateHigh: PRICE_BOOK.walls.rateHigh,
      low: measurements.wallArea * PRICE_BOOK.walls.rateLow,
      high: measurements.wallArea * PRICE_BOOK.walls.rateHigh,
      required: true,
      defaultIncluded: true,
    },
  ];

  if (typeof measurements.ceilingArea === "number") {
    lines.push({
      id: "ceiling",
      label: "Ceiling painting · two coats",
      detail: `${Math.round(measurements.ceilingArea)} sq ft · ${PRICE_BOOK.ceiling.detailRateLabel}`,
      quantity: measurements.ceilingArea,
      unit: "sq ft",
      rateLow: PRICE_BOOK.ceiling.rateLow,
      rateHigh: PRICE_BOOK.ceiling.rateHigh,
      low: measurements.ceilingArea * PRICE_BOOK.ceiling.rateLow,
      high: measurements.ceilingArea * PRICE_BOOK.ceiling.rateHigh,
      required: false,
      defaultIncluded: ceilingIntent === "include" || (ceilingIntent === null && /\boverhead\b/.test(lowered)),
    });
  }

  if (typeof measurements.trimLength === "number") {
    lines.push({
      id: "trim",
      label: "Baseboards and trim",
      detail: `${Math.round(measurements.trimLength)} linear ft · ${PRICE_BOOK.trim.detailRateLabel}`,
      quantity: measurements.trimLength,
      unit: "linear ft",
      rateLow: PRICE_BOOK.trim.rateLow,
      rateHigh: PRICE_BOOK.trim.rateHigh,
      low: measurements.trimLength * PRICE_BOOK.trim.rateLow,
      high: measurements.trimLength * PRICE_BOOK.trim.rateHigh,
      required: false,
      defaultIncluded: spokenIntent(note, "trim") === "include",
    });
  }

  if (typeof measurements.doorSides === "number" && measurements.doorSides > 0) {
    lines.push({
      id: "doors",
      label: "Doors and frames",
      detail: `${measurements.doorSides} paintable side${measurements.doorSides === 1 ? "" : "s"} · ${PRICE_BOOK.doors.detailRateLabel}`,
      quantity: measurements.doorSides,
      unit: "side",
      rateLow: PRICE_BOOK.doors.rateLow,
      rateHigh: PRICE_BOOK.doors.rateHigh,
      low: measurements.doorSides * PRICE_BOOK.doors.rateLow,
      high: measurements.doorSides * PRICE_BOOK.doors.rateHigh,
      required: false,
      defaultIncluded: mode === "demo" ? /\b(door|frame)\b/.test(lowered) : spokenIntent(note, "doors") !== "exclude",
    });
  }

  if (typeof measurements.patchCount === "number" && measurements.patchCount > 0) {
    lines.push({
      id: "patch",
      label: "Minor drywall patch allowance",
      detail: `${measurements.patchCount} selected spot${measurements.patchCount === 1 ? "" : "s"} · ${PRICE_BOOK.patch.detailRateLabel}`,
      quantity: measurements.patchCount,
      unit: "patch",
      rateLow: PRICE_BOOK.patch.rateLow,
      rateHigh: PRICE_BOOK.patch.rateHigh,
      low: measurements.patchCount * PRICE_BOOK.patch.rateLow,
      high: measurements.patchCount * PRICE_BOOK.patch.rateHigh,
      required: false,
      defaultIncluded: mode === "demo" ? /\b(patch|repair|crack|dent|hole)\b/.test(lowered) : true,
    });
  }

  const issues = assessment?.surfaceConditions?.issues ?? [];
  if (issues.length) {
    const named = issues.map((issue) => ISSUE_LABELS[issue]);
    lines.push({
      id: "repair",
      label: "Surface condition repair allowance",
      detail: `${named.join(", ")} · scrape, treat and seal before paint · ${PRICE_BOOK.repair.detailRateLabel}`,
      quantity: issues.length,
      unit: "condition",
      rateLow: PRICE_BOOK.repair.rateLow,
      rateHigh: PRICE_BOOK.repair.rateHigh,
      low: issues.length * PRICE_BOOK.repair.rateLow,
      high: issues.length * PRICE_BOOK.repair.rateHigh,
      required: false,
      defaultIncluded: true,
      evidenceBadge: { model: "Muse Spark 1.3", detail: `Visible ${named.join(", ")} detected` },
    });
  }

  if (wallTone === "dark" && lightnessFromHex(color.hex) > lightnessFromHex(PRICE_BOOK.primer.darkWallReferenceHex)) {
    lines.push({
      id: "primer",
      label: "Dark-to-light primer allowance",
      detail: `${Math.round(measurements.wallArea)} sq ft · ${PRICE_BOOK.primer.detailRateLabel}`,
      quantity: measurements.wallArea,
      unit: "sq ft",
      rateLow: PRICE_BOOK.primer.rate,
      rateHigh: PRICE_BOOK.primer.rate,
      low: measurements.wallArea * PRICE_BOOK.primer.rate,
      high: measurements.wallArea * PRICE_BOOK.primer.rate,
      required: true,
      defaultIncluded: true,
    });
  }

  if (features?.crownMoldingPresent && typeof measurements.perimeterFt === "number" && measurements.perimeterFt > 0) {
    const lf = measurements.perimeterFt;
    const trimIndex = lines.findIndex((line) => line.id === "trim");
    lines.splice(trimIndex >= 0 ? trimIndex + 1 : lines.length, 0, {
      id: "crown",
      label: "Crown molding painting · recommended",
      detail: `${Math.round(lf)} linear ft · ${PRICE_BOOK.crown.detailRateLabel}`,
      quantity: lf,
      unit: "linear ft",
      rateLow: PRICE_BOOK.crown.rateLow,
      rateHigh: PRICE_BOOK.crown.rateHigh,
      low: lf * PRICE_BOOK.crown.rateLow,
      high: lf * PRICE_BOOK.crown.rateHigh,
      required: false,
      defaultIncluded: true,
    });
  }

  if (assessment && mode !== "demo") applyGroundedEvidence(lines, measurements, assessment, evidence);
  return assessment ? applyConfidence(lines, assessment, note, evidence) : lines;
}

export const ISSUE_LABELS: Record<SurfaceIssue, string> = {
  peeling: "peeling paint",
  water_stains: "water stains",
  cracks: "cracks",
  mildew: "mildew",
};

/** Marks each line Grounded or Confirm on site from Muse Spark's confidence, conditions and voice/vision checks. */
function applyConfidence(lines: ScopeLine[], assessment: RoomAssessment, note: string, sam?: ScopeEvidenceOptions): ScopeLine[] {
  const model = assessment.lineConfidence ?? {};
  const features = assessment.architecturalFeatures ?? null;
  const issues = assessment.surfaceConditions?.issues ?? [];
  const samDoors = (sam?.doorCounts ?? []).filter((count): count is number => typeof count === "number");
  const reasons: Partial<Record<ScopeId, string>> = {};
  const flag = (id: ScopeId, reason: string) => { reasons[id] ??= reason; };
  if (doorCountConflict(note, assessment, sam?.doorCounts)) flag("doors", "Your spoken door count differs from the camera");
  if (samDoors.length && assessment.visibleDoorCount !== null && assessment.visibleDoorCount !== undefined && Math.max(...samDoors) !== assessment.visibleDoorCount) flag("doors", "Muse Spark and SAM 3.1 counted different doors");
  if (issues.includes("water_stains")) flag("ceiling", "Water stains: check for an active leak first");
  if (features?.ceilingType === "vaulted_high") flag("ceiling", "High ceiling height estimated from photos");
  if (features?.baseboardStyle === "unknown") flag("trim", "Baseboards hidden in the photos");
  if (features?.wallTexture === "unknown") flag("walls", "Wall texture not clear in the photos");
  if (issues.some((issue) => issue !== "water_stains")) flag("walls", "Visible damage may hide more prep");
  if (issues.includes("cracks")) flag("patch", "Cracks can run longer than visible");
  flag("repair", "Hidden extent: painter verifies before final price");
  for (const [id, level] of Object.entries(model)) if (level === "low") flag(id as ScopeId, "Muse Spark could not see this surface clearly");
  return lines.map((item) => reasons[item.id]
    ? { ...item, confidence: "confirm_on_site" as const, confidenceNote: reasons[item.id] }
    : { ...item, confidence: "grounded" as const });
}

export interface ScopeEvidenceOptions {
  trimDetected?: boolean;
  doorCounts?: Array<number | null>;
}

const TALL_TRIM_FACTOR = 1.25;
const HIGH_CEILING_FACTOR = 1.3;

function rescale(line: ScopeLine, factor: number) {
  line.rateLow = Math.round(line.rateLow * factor * 100) / 100;
  line.rateHigh = Math.round(line.rateHigh * factor * 100) / 100;
  line.low = line.quantity * line.rateLow;
  line.high = line.quantity * line.rateHigh;
  line.detail = `${Math.round(line.quantity)} ${line.unit} · $${line.rateLow.toFixed(2)}–$${line.rateHigh.toFixed(2)} per ${line.unit === "sq ft" ? "sq ft" : "linear ft"}`;
}

function applyGroundedEvidence(lines: ScopeLine[], m: RoomDimensions, a: RoomAssessment, opts: ScopeEvidenceOptions) {
  const f = a.architecturalFeatures ?? null;
  const ceilingFt = m.ceilingHeightFt ?? a.suggestedDimensions?.ceilingHeightFt ?? null;
  const badge = (model: EvidenceBadge["model"], detail: string): EvidenceBadge => ({ model, detail });
  const samDoorsSeen = (opts.doorCounts ?? []).some((count) => typeof count === "number");
  for (const line of lines) {
    if (line.id === "walls") {
      const parts: string[] = [];
      if (a.visibleWallCount) parts.push(`${a.visibleWallCount} walls identified`);
      if (f?.wallTexture === "smooth") parts.push("smooth drywall texture");
      else if (f?.wallTexture === "textured") parts.push("textured wall finish");
      parts.push(`${Math.round(m.wallArea)} sq ft net`);
      line.evidenceBadge = badge("Muse Spark 1.3", parts.join(" · "));
    } else if (line.id === "ceiling") {
      if (f?.ceilingType === "vaulted_high") rescale(line, HIGH_CEILING_FACTOR);
      const h = ceilingFt ? `${ceilingFt}ft` : "";
      const detail = f?.ceilingType === "vaulted_high" ? `High or vaulted ceiling${h ? ` (${h})` : ""} · ladder/staging labor`
        : f?.ceilingType === "textured" ? `Textured ${h} ceiling`.replace(/\s+/g, " ")
        : `Standard ${h} flat ceiling`.replace(/\s+/g, " ");
      line.evidenceBadge = badge("Muse Spark 1.3", detail);
    } else if (line.id === "trim") {
      if (f?.baseboardStyle === "tall_decorative") rescale(line, TALL_TRIM_FACTOR);
      const style = f?.baseboardStyle === "tall_decorative" ? "tall decorative" : f?.baseboardStyle === "none" ? "no" : 'standard 4"';
      const detail = `~${Math.round(line.quantity)} LF ${style} baseboards detected${f?.crownMoldingPresent ? " · crown molding" : ""}`;
      line.evidenceBadge = badge(opts.trimDetected ? "Muse Spark + SAM 3.1" : "Muse Spark 1.3", detail);
    } else if (line.id === "crown") {
      line.evidenceBadge = badge("Muse Spark 1.3", `Crown molding detected along the wall-to-ceiling junction · ~${Math.round(line.quantity)} LF`);
    } else if (line.id === "doors") {
      const doors = a.visibleDoorCount ?? Math.round(line.quantity / 2);
      line.evidenceBadge = samDoorsSeen
        ? badge("Muse Spark + SAM 3.1", `${doors} floor-to-lintel door opening${doors === 1 ? "" : "s"} cross-checked by SAM 3.1`)
        : badge("Muse Spark 1.3", `${doors} door opening${doors === 1 ? "" : "s"} seen`);
    } else if (line.id === "patch") {
      const marks = a.visibleMarkCount ?? line.quantity;
      const prep = f?.prepNeeds?.length ? ` · ${f.prepNeeds.map((n) => n.replace(/_/g, " ")).join(", ")}` : "";
      line.evidenceBadge = badge("Muse Spark 1.3", `${marks} visible mark${marks === 1 ? "" : "s"}${prep}`);
    }
  }
}

export interface InventoryEntry {
  key: string;
  label: string;
  value: string;
}

const LABELS: Record<string, string> = {
  standard: "Standard", tall_decorative: "Tall decorative", none: "None", unknown: "Not clear",
  smooth: "Smooth", textured: "Textured",
};

export function architecturalInventory(features?: ArchitecturalFeatures | null, ceilingHeightFt?: number | null): InventoryEntry[] {
  if (!features) return [];
  const h = typeof ceilingHeightFt === "number" && ceilingHeightFt > 0 ? Math.round(ceilingHeightFt) : null;
  const ceiling = features.ceilingType === "vaulted_high" ? `${h && h >= 10 ? h : 9}'+ High`
    : features.ceilingType === "textured" ? `${h ? `${h}' ` : ""}Textured`
    : features.ceilingType === "flat" ? `${h ? `${h}' ` : ""}Flat` : `${h ? `${h}' ` : ""}Standard`;
  const entries: InventoryEntry[] = [
    { key: "crown", label: "Crown molding", value: features.crownMoldingPresent ? "Detected" : "None" },
    { key: "baseboards", label: "Baseboards", value: LABELS[features.baseboardStyle] ?? "Standard" },
    { key: "ceiling", label: "Ceiling", value: ceiling },
    { key: "walls", label: "Walls", value: LABELS[features.wallTexture] ?? "Not clear" },
  ];
  if (features.prepNeeds.length) entries.push({ key: "prep", label: "Prep", value: features.prepNeeds.map((n) => n.replace(/_/g, " ")).join(", ") });
  return entries;
}

export function calculateTotals(items: ScopeLine[], selection: ScopeSelections): QuoteTotals {
  const included = items.filter((item) => itemIsIncluded(item, selection));
  const subtotalLow = included.reduce((sum, item) => sum + item.low, 0);
  const subtotalHigh = included.reduce((sum, item) => sum + item.high, 0);
  const taxLow = subtotalLow * PRICE_BOOK.taxAndConsumables.rate;
  const taxHigh = subtotalHigh * PRICE_BOOK.taxAndConsumables.rate;
  return {
    subtotalLow,
    subtotalHigh,
    taxLow,
    taxHigh,
    low: subtotalLow + taxLow,
    high: subtotalHigh + taxHigh,
  };
}

export function statusForBudget(totals: QuoteTotals, budget: number | null) {
  if (budget === null) return "market" as const;
  if (totals.high <= budget) return "within" as const;
  if (totals.low <= budget) return "close" as const;
  return "over" as const;
}

export function budgetStatusLabel(status: ReturnType<typeof statusForBudget>) {
  return status === "within" ? "Within budget" : status === "close" ? "Close match" : status === "over" ? "Over budget" : "Market range";
}

export function bestBudgetFit(items: ScopeLine[], selection: ScopeSelections, budget: number) {
  const required = items.filter((item) => item.required);
  const available = items.filter((item) => !item.required && itemIsIncluded(item, selection));
  let best: { selection: ScopeSelections; removedHigh: number; removedCount: number } | null = null;
  const combinations = 1 << available.length;

  for (let mask = 0; mask < combinations; mask += 1) {
    const nextSelection: ScopeSelections = { ...selection };
    let removedHigh = 0;
    let removedCount = 0;
    available.forEach((item, index) => {
      const keep = (mask & (1 << index)) !== 0;
      nextSelection[item.id] = keep;
      if (!keep) {
        removedHigh += item.high;
        removedCount += 1;
      }
    });
    const totals = calculateTotals(items, nextSelection);
    if (totals.high <= budget && (!best || removedHigh < best.removedHigh || (removedHigh === best.removedHigh && removedCount < best.removedCount))) {
      best = { selection: nextSelection, removedHigh, removedCount };
    }
  }

  if (best) return { selection: best.selection, totals: calculateTotals(items, best.selection), fits: true };
  const requiredOnly: ScopeSelections = { ...selection };
  items.filter((item) => !item.required).forEach((item) => { requiredOnly[item.id] = false; });
  return { selection: requiredOnly, totals: calculateTotals(items, requiredOnly), fits: false };
}
