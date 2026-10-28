import type { PaintColor, QuoteTotals, RoomDimensions, ScopeLine, ScopeSelections, WallTone } from "@/types/estimate";

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
): ScopeLine[] {
  const lowered = note.toLowerCase();
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
      defaultIncluded: /\b(ceiling|overhead)\b/.test(lowered),
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
      defaultIncluded: /\b(trim|baseboard|molding|moulding)\b/.test(lowered),
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
      defaultIncluded: mode === "demo" ? /\b(door|frame)\b/.test(lowered) : true,
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

  return lines;
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
