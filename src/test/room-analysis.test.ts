import { describe, expect, it } from "vitest";
import {
  grossWallAreaSqFt,
  netWallAreaSqFt,
  normalizeRoomType,
  openingDeductionSqFt,
  standardRoomDimensions,
  crossCheckOpeningCount,
  numberRoomLabels,
  roomTypeName,
} from "@/lib/room-sizes";
import { buildObservePrompt, countSamBoxes, parseObservationJson, spokenDimensions } from "@/lib/analyze-room.shared.server";
import { selectDistinctKeyframes, type KeyframeCandidate } from "@/lib/room-media";
import { architecturalInventory, buildScopeLines } from "@/lib/pricing";
import type { RoomAssessment, RoomDimensions } from "@/types/estimate";

describe("wall area math", () => {
  it("computes gross, deduction, and net areas", () => {
    expect(grossWallAreaSqFt(12, 14, 8)).toBe(416);
    expect(openingDeductionSqFt(1, 2)).toBe(50);
    expect(openingDeductionSqFt(null, undefined)).toBe(0);
    expect(netWallAreaSqFt(416, 50)).toBe(366);
  });

  it("never drops net area below 50 sq ft", () => {
    expect(netWallAreaSqFt(60, openingDeductionSqFt(3, 2))).toBe(50);
  });

  it("maps room types to standard US sizes", () => {
    expect(normalizeRoomType("Master Bedroom")).toBe("primary_bedroom");
    expect(normalizeRoomType("living room")).toBe("living_room");
    expect(normalizeRoomType(undefined)).toBe("other");
    expect(standardRoomDimensions("kitchen")).toMatchObject({ lengthFt: 10, widthFt: 12, ceilingHeightFt: 8 });
  });
});

describe("parseObservationJson", () => {
  it("parses fenced JSON with trailing commas and keeps counts", () => {
    const result = parseObservationJson('```json\n{"roomType":"bedroom","visibleWallCount":4,"visibleDoorCount":1,"visibleWindowCount":2,"scaleReference":"standard_door","dimensionConfidence":"medium","suggestedDimensions":{"lengthFt":11,"widthFt":13,"ceilingHeightFt":8},"observations":["Light gray walls",],}\n```');
    expect(result.visibleDoorCount).toBe(1);
    expect(result.visibleWindowCount).toBe(2);
    expect(result.suggestedDimensions).toMatchObject({ lengthFt: 13, widthFt: 11, ceilingHeightFt: 8, confidence: "medium" });
    expect(result.openingDeductionSqFt).toBe(50);
    expect(result.scaleReference).toBe("standard_door");
    expect(result.observations[0]).toMatch(/4 distinct walls/);
  });

  it("falls back to the standard US size for the room type when no size is given", () => {
    const result = parseObservationJson('{"roomType":"living_room","suggestedDimensions":null,"scaleReference":"none"}');
    expect(result.suggestedDimensions).toMatchObject({ lengthFt: 14, widthFt: 18, ceilingHeightFt: 8, confidence: "low" });
    expect(result.observations).toEqual([]);
  });

  it("derives counts from the wall inventory and prefers spoken sizes", () => {
    const text = JSON.stringify({
      wallInventory: [{ wall: "A", doorCount: 1, windowCount: 0 }, { wall: "B", doorCount: 0, windowCount: 2 }, { wall: "C" }, { wall: "D", doorCount: 1 }],
      suggestedDimensions: { lengthFt: 10, widthFt: 10, ceilingHeightFt: 8 },
    });
    const result = parseObservationJson(text, "The room is about 12 by 15 feet with 9 foot ceilings");
    expect(result.visibleWallCount).toBe(4);
    expect(result.visibleDoorCount).toBe(2);
    expect(result.visibleWindowCount).toBe(2);
    expect(result.suggestedDimensions).toMatchObject({ lengthFt: 15, widthFt: 12, ceilingHeightFt: 9 });
  });

  it("rejects output with no JSON", () => {
    expect(() => parseObservationJson("Sorry, I cannot help")).toThrow("observations-invalid");
  });

  it("reads spoken dimensions", () => {
    expect(spokenDimensions("it's 14x16")).toMatchObject({ lengthFt: 16, widthFt: 14, ceilingHeightFt: null });
  });

  it("asks for walls, doors vs windows, and dimensions", () => {
    const prompt = buildObservePrompt("", "homeowner");
    expect(prompt).toMatch(/STEP 1 - WALLS/);
    expect(prompt).toMatch(/DOORS vs WINDOWS/);
    expect(prompt).toMatch(/ALWAYS return suggestedDimensions/);
  });
});

describe("architectural features", () => {
  it("extracts and sanitizes trim, ceiling and prep inventory", () => {
    const result = parseObservationJson(JSON.stringify({
      visibleMarkCount: 0,
      suggestedDimensions: { lengthFt: 12, widthFt: 14, ceilingHeightFt: 8 },
      architecturalFeatures: { crownMoldingPresent: true, baseboardStyle: "Tall Decorative", doorCasingStyle: "cased-opening", ceilingType: "textured", wallTexture: "smooth", prepNeeds: ["nail_holes", "nail_holes", "bogus", 7, "trim_caulking"] },
    }));
    expect(result.architecturalFeatures).toEqual({
      crownMoldingPresent: true,
      baseboardStyle: "tall_decorative",
      doorCasingStyle: "cased_opening",
      ceilingType: "textured",
      wallTexture: "smooth",
      prepNeeds: ["nail_holes", "trim_caulking"],
    });
  });

  it("falls back to safe standard values when keys are absent or malformed", () => {
    expect(parseObservationJson('{"roomType":"bedroom"}').architecturalFeatures).toEqual({
      crownMoldingPresent: false, baseboardStyle: "standard", doorCasingStyle: "standard", ceilingType: "standard", wallTexture: "unknown", prepNeeds: [],
    });
    const malformed = parseObservationJson('{"visibleMarkCount":2,"suggestedDimensions":{"lengthFt":12,"widthFt":12,"ceilingHeightFt":11},"architecturalFeatures":{"crownMoldingPresent":"maybe","baseboardStyle":42,"prepNeeds":"scuffs"}}');
    expect(malformed.architecturalFeatures).toMatchObject({ crownMoldingPresent: false, baseboardStyle: "standard", ceilingType: "vaulted_high", prepNeeds: ["scuffs"] });
    expect(parseObservationJson('{"architecturalFeatures":[1,2]}').architecturalFeatures.baseboardStyle).toBe("standard");
  });

  it("asks Muse Spark to inspect crown, baseboards, casing, ceiling and prep", () => {
    const prompt = buildObservePrompt("", "homeowner");
    expect(prompt).toMatch(/CROWN MOLDING/);
    expect(prompt).toMatch(/tall_decorative/);
    expect(prompt).toMatch(/vaulted_high/);
    expect(prompt).toMatch(/nail_holes/);
  });
});

describe("grounded scope evidence", () => {
  const dims: RoomDimensions = { roomShape: "rectangular", lengthFt: 14, widthFt: 12, ceilingHeightFt: 8, grossWallArea: 416, openingDeductionSqFt: 50, wallArea: 366, ceilingArea: 168, trimLength: 49, perimeterFt: 52, doorSides: 2, patchCount: 2 };
  const assessment: RoomAssessment = {
    visibleDoorCount: 2, visibleWindowCount: 1, visibleMarkCount: 2, wallTone: "light", scaleReference: "standard_door", suggestedDimensions: null, openingDeductionSqFt: 50, visibleWallCount: 4,
    architecturalFeatures: { crownMoldingPresent: true, baseboardStyle: "standard", doorCasingStyle: "standard", ceilingType: "flat", wallTexture: "smooth", prepNeeds: ["scuffs"] },
  };
  const color = { name: "White", hex: "#ffffff" };

  it("attaches Meta model evidence badges to each line", () => {
    const lines = buildScopeLines(dims, color, "light", "", "homeowner", assessment, { trimDetected: true, doorCounts: [1, 1, null] });
    const byId = Object.fromEntries(lines.map((line) => [line.id, line]));
    expect(byId.walls.evidenceBadge).toEqual({ model: "Muse Spark 1.3", detail: "4 walls identified · smooth drywall texture · 366 sq ft net" });
    expect(byId.ceiling.evidenceBadge?.detail).toBe("Standard 8ft flat ceiling");
    expect(byId.trim.evidenceBadge).toMatchObject({ model: "Muse Spark + SAM 3.1" });
    expect(byId.trim.evidenceBadge?.detail).toMatch(/~49 LF standard 4" baseboards detected · crown molding/);
    expect(byId.doors.evidenceBadge?.detail).toMatch(/2 floor-to-lintel door openings cross-checked by SAM 3.1/);
    expect(byId.patch.evidenceBadge?.detail).toMatch(/2 visible marks · scuffs/);
    expect(byId.crown).toMatchObject({ required: false, defaultIncluded: true, quantity: 52 });
  });

  it("adjusts labor for tall trim and high ceilings, and keeps legacy output without an assessment", () => {
    const tall = buildScopeLines(dims, color, "light", "", "homeowner", { ...assessment, architecturalFeatures: { ...assessment.architecturalFeatures!, baseboardStyle: "tall_decorative", ceilingType: "vaulted_high", crownMoldingPresent: false } });
    expect(tall.find((line) => line.id === "trim")?.rateHigh).toBe(6.25);
    expect(tall.find((line) => line.id === "ceiling")?.rateLow).toBe(1.95);
    expect(tall.some((line) => line.id === "crown")).toBe(false);
    const legacy = buildScopeLines(dims, color, "light", "", "homeowner");
    expect(legacy.every((line) => !line.evidenceBadge)).toBe(true);
    expect(legacy.find((line) => line.id === "walls")?.rateLow).toBe(2);
  });

  it("summarizes the architectural inventory", () => {
    expect(architecturalInventory(assessment.architecturalFeatures, 8).map((entry) => entry.value).slice(0, 4)).toEqual(["Detected", "Standard", "8' Flat", "Smooth"]);
    expect(architecturalInventory(null)).toEqual([]);
  });
});

describe("selectDistinctKeyframes", () => {
  const frame = (t: number, brightness: number, sharpness: number, level: number): KeyframeCandidate => ({
    timestampSeconds: t,
    brightness,
    contrast: brightness < 10 ? 1 : 30,
    sharpness,
    signature: Array.from({ length: 8 }, (_, i) => (i % 2 ? level : -level)),
  });

  it("skips black frames and spreads picks across the walk", () => {
    const candidates = [frame(0, 2, 0, 0), frame(1, 3, 0, 0), ...Array.from({ length: 10 }, (_, i) => frame(2 + i * 2, 120, 5 + (i % 3), i * 10))];
    const picks = selectDistinctKeyframes(candidates, 4);
    expect(picks).toHaveLength(4);
    expect(picks.every((pick) => pick.brightness > 20)).toBe(true);
    const times = picks.map((pick) => pick.timestampSeconds);
    expect(new Set(times).size).toBe(4);
    expect(times[0]).toBeLessThan(8);
    expect(times[3]).toBeGreaterThan(14);
  });

  it("returns at least three usable frames when only three are lit", () => {
    const candidates = [frame(0, 1, 0, 0), frame(5, 100, 4, 5), frame(10, 100, 4, 20), frame(15, 100, 4, 40), frame(20, 2, 0, 0)];
    expect(selectDistinctKeyframes(candidates, 4).map((pick) => pick.timestampSeconds)).toEqual([5, 10, 15]);
  });
});

describe("SAM 3.1 opening cross-check", () => {
  const box = (x1: number, y1: number, x2: number, y2: number) => `<|box;x1=${x1};y1=${y1};x2=${x2};y2=${y2};w=1000;h=800|><|mask;x=0;y=0;data=1,1,~|>`;

  it("counts distinct, large enough SAM detections", () => {
    const line = `<0f>0${box(100, 100, 300, 700)},1${box(110, 110, 290, 690)},2${box(600, 150, 800, 750)},3${box(10, 10, 20, 20)}`;
    expect(countSamBoxes(line, "door")).toBe(2);
    expect(countSamBoxes(`<0f>0${box(100, 100, 300, 300)}`, "door")).toBe(0);
    expect(countSamBoxes(`<0f>0${box(100, 100, 300, 300)}`, "window")).toBe(1);
    expect(countSamBoxes("", "window")).toBe(0);
  });

  it("flags Muse Spark counts outside the SAM per-frame range", () => {
    expect(crossCheckOpeningCount(1, [2, 0, 1, null])).toEqual({ status: "muse_low", samMin: 2, samMax: 3, suggested: 2 });
    expect(crossCheckOpeningCount(5, [1, 1, 0, 1])).toEqual({ status: "muse_high", samMin: 1, samMax: 3, suggested: 3 });
    expect(crossCheckOpeningCount(2, [1, 1, 1, 0]).status).toBe("agree");
    expect(crossCheckOpeningCount(2, [null, null]).status).toBe("unavailable");
  });

  it("names rooms for the walkthrough list", () => {
    expect(roomTypeName("living_room")).toBe("Living room");
    expect(roomTypeName(undefined)).toBe("Room");
    expect(numberRoomLabels(["Bedroom", "Living room", "Bedroom"])).toEqual(["Bedroom", "Living room", "Bedroom 2"]);
  });
});

