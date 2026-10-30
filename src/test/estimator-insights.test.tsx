import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildObservePrompt, parseObservationJson } from "@/lib/analyze-room.shared.server";
import { buildScopeLines } from "@/lib/pricing";
import { materialsSummary, materialsTakeoff, reconcileVoiceVision, siteChecks, spokenCount, spokenIntent } from "@/lib/estimator-insights";
import { MaterialsCard, SiteChecksCard, VoiceVisionCard } from "@/components/estimate/EstimatorInsights";
import type { RoomAssessment, RoomDimensions } from "@/types/estimate";

const dims: RoomDimensions = { roomShape: "rectangular", lengthFt: 14, widthFt: 12, ceilingHeightFt: 8, grossWallArea: 416, openingDeductionSqFt: 50, wallArea: 366, ceilingArea: 168, trimLength: 49, perimeterFt: 52, doorSides: 2, patchCount: 2 };
const color = { name: "White", hex: "#ffffff" };
const base: RoomAssessment = {
  visibleDoorCount: 3, visibleWindowCount: 1, visibleMarkCount: 0, wallTone: "light", scaleReference: "standard_door", suggestedDimensions: null, openingDeductionSqFt: 50, visibleWallCount: 4, roomType: "bedroom",
  architecturalFeatures: { crownMoldingPresent: true, baseboardStyle: "standard", doorCasingStyle: "standard", ceilingType: "flat", wallTexture: "smooth", prepNeeds: [] },
  surfaceConditions: { issues: [], leadPaintCaution: false },
  lineConfidence: {},
};

describe("Muse Spark conditions and confidence parsing", () => {
  it("extracts visible damage, lead caution and per-line confidence", () => {
    const result = parseObservationJson(JSON.stringify({
      surfaceConditions: { issues: ["Peeling", "water stains", "rust", 4], olderHomeCues: false },
      lineConfidence: { walls: "HIGH", trim: "low", doors: "maybe", roof: "low" },
    }));
    expect(result.surfaceConditions).toEqual({ issues: ["peeling", "water_stains"], leadPaintCaution: true });
    expect(result.lineConfidence).toEqual({ walls: "high", trim: "low" });
  });

  it("defaults safely when the model omits or mangles the keys", () => {
    const result = parseObservationJson('{"surfaceConditions":"none","lineConfidence":[1]}');
    expect(result.surfaceConditions).toEqual({ issues: [], leadPaintCaution: false });
    expect(result.lineConfidence).toEqual({});
    expect(parseObservationJson('{"surfaceConditions":{"olderHomeCues":"yes"}}').surfaceConditions?.leadPaintCaution).toBe(true);
  });

  it("asks Muse Spark for conditions and confidence without copying spoken counts", () => {
    const prompt = buildObservePrompt("two doors", "homeowner");
    expect(prompt).toMatch(/STEP 6 - CONDITIONS AND CONFIDENCE/);
    expect(prompt).toMatch(/water_stains/);
    expect(prompt).toMatch(/never copy counts from the note/);
  });
});

describe("Grounded vs Confirm on site", () => {
  it("grounds clear lines and flags uncertain ones with a reason", () => {
    const assessment: RoomAssessment = { ...base, visibleDoorCount: 2, surfaceConditions: { issues: ["water_stains", "cracks"], leadPaintCaution: false }, lineConfidence: { trim: "low" } };
    const lines = buildScopeLines(dims, color, "light", "", "homeowner", assessment, { doorCounts: [2] });
    const byId = Object.fromEntries(lines.map((line) => [line.id, line]));
    expect(byId.doors.confidence).toBe("grounded");
    expect(byId.crown.confidence).toBe("grounded");
    expect(byId.trim).toMatchObject({ confidence: "confirm_on_site", confidenceNote: "Muse Spark could not see this surface clearly" });
    expect(byId.ceiling.confidenceNote).toMatch(/Water stains/);
    expect(byId.patch.confidenceNote).toMatch(/Cracks/);
    expect(byId.repair).toMatchObject({ quantity: 2, defaultIncluded: true, confidence: "confirm_on_site" });
    expect(byId.repair.detail).toMatch(/water stains, cracks/);
  });

  it("flags doors when voice and both vision models disagree", () => {
    const lines = buildScopeLines(dims, color, "light", "there are two doors", "homeowner", base, { doorCounts: [3, 2] });
    expect(lines.find((line) => line.id === "doors")).toMatchObject({ confidence: "confirm_on_site", confidenceNote: "Your spoken door count differs from the camera" });
  });

  it("leaves estimates without an assessment unflagged", () => {
    expect(buildScopeLines(dims, color, "light", "", "homeowner").every((line) => line.confidence === undefined)).toBe(true);
  });
});

describe("voice vs vision reconciliation", () => {
  it("parses spoken counts and scope intents", () => {
    expect(spokenCount("we have two closet doors and 3 windows", "door")).toBe(2);
    expect(spokenCount("we have two closet doors and 3 windows", "window")).toBe(3);
    expect(spokenCount("a few doors", "door")).toBeNull();
    expect(spokenIntent("please don't paint the ceiling", "ceiling")).toBe("exclude");
    expect(spokenIntent("the ceiling is fine", "ceiling")).toBe("exclude");
    expect(spokenIntent("do the ceiling and baseboards too", "ceiling")).toBe("include");
    expect(spokenIntent("do the ceiling and baseboards too", "trim")).toBe("include");
    expect(spokenIntent("walls only", "ceiling")).toBeNull();
  });

  it("flags 2 spoken doors against 3 seen and confirms matching windows", () => {
    const checks = reconcileVoiceVision("Two doors, one window, skip the ceiling", base, { doors: [3, 1], windows: [1] });
    expect(checks.find((check) => check.id === "doors")).toMatchObject({ status: "conflict", message: "You said 2 doors · Muse Spark saw 3 · SAM 3.1 outlined 3 in one view · confirm on site" });
    expect(checks.find((check) => check.id === "windows")?.status).toBe("match");
    expect(checks.find((check) => check.id === "ceiling")?.status).toBe("intent");
  });

  it("warns when the homeowner skips a water-stained ceiling", () => {
    const stained = { ...base, surfaceConditions: { issues: ["water_stains" as const], leadPaintCaution: false } };
    expect(reconcileVoiceVision("leave the ceiling", stained).find((check) => check.id === "ceiling")?.status).toBe("conflict");
  });

  it("honours a spoken ceiling exclusion in the default scope", () => {
    const excluded = buildScopeLines(dims, color, "light", "don't paint the ceiling", "homeowner", base);
    expect(excluded.find((line) => line.id === "ceiling")?.defaultIncluded).toBe(false);
    const included = buildScopeLines(dims, color, "light", "ceiling too please", "homeowner", base);
    expect(included.find((line) => line.id === "ceiling")?.defaultIncluded).toBe(true);
  });
});

describe("materials takeoff", () => {
  it("computes gallons at 350 sq ft per coat with sheens per surface", () => {
    const lines = buildScopeLines(dims, color, "light", "ceiling and trim", "homeowner", base);
    const takeoff = materialsTakeoff(lines, base);
    const byId = Object.fromEntries(takeoff.lines.map((line) => [line.id, line]));
    expect(byId.walls).toMatchObject({ sheen: "Eggshell", coats: 2, gallons: 2.25, buy: "3 gal" });
    expect(byId.ceiling).toMatchObject({ sheen: "Flat", gallons: 1, buy: "1 gal" });
    expect(byId.trim).toMatchObject({ sheen: "Semi-gloss", gallons: 0.5, buy: "2 qt" });
    expect(takeoff).toMatchObject({ primerRequired: true, totalGallons: 3.75 });
    expect(takeoff.primer[0].product).toMatch(/Spot primer for patched areas/);
  });

  it("requires full primer for dark-to-light and spot primers for conditions, satin in wet rooms", () => {
    const bath: RoomAssessment = { ...base, roomType: "bathroom", surfaceConditions: { issues: ["mildew"], leadPaintCaution: false } };
    const lines = buildScopeLines({ ...dims, patchCount: 0 }, color, "dark", "", "homeowner", bath);
    const takeoff = materialsTakeoff(lines.filter((line) => line.id === "walls" || line.id === "primer"), bath);
    expect(takeoff.lines[0].sheen).toBe("Satin");
    expect(takeoff.primer.map((need) => need.product)).toEqual(["High-hide primer (full walls)", "Mildew wash + mildew-resistant primer (spot)"]);
    expect(takeoff.primer[0].buy).toBe("2 gal");
  });

  it("says primer is not required over sound surfaces", () => {
    const lines = buildScopeLines({ ...dims, patchCount: 0 }, color, "light", "", "homeowner", base).filter((line) => line.id === "walls");
    expect(materialsSummary(materialsTakeoff(lines, base)).at(-1)).toBe("Primer: not required over sound, previously painted surfaces");
  });
});

describe("estimator insight cards", () => {
  it("renders conditions, lead caution, voice checks and materials", () => {
    const assessment: RoomAssessment = { ...base, surfaceConditions: { issues: ["peeling"], leadPaintCaution: true } };
    const lines = buildScopeLines(dims, color, "light", "two doors", "homeowner", assessment, { doorCounts: [3] });
    render(<>
      <SiteChecksCard assessment={assessment} includedItems={lines} />
      <VoiceVisionCard transcript="two doors" assessment={assessment} sam={{ doors: [3], windows: [] }} />
      <MaterialsCard includedItems={lines} assessment={assessment} />
    </>);
    expect(screen.getByTestId("condition-peeling")).toHaveTextContent("peeling paint");
    expect(screen.getByTestId("lead-paint-caution")).toHaveTextContent("1978");
    expect(screen.getByTestId("voice-check-doors")).toHaveTextContent("You said 2 doors");
    expect(screen.getByTestId("material-walls")).toHaveTextContent("Eggshell");
    expect(screen.getByTestId("material-primer")).toHaveTextContent("Bonding primer");
    expect(siteChecks(assessment, lines, reconcileVoiceVision("two doors", assessment, { doors: [3] })).some((entry) => entry.startsWith("Voice vs vision"))).toBe(true);
  });
});
