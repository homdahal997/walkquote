export const DOOR_OPENING_SQFT = 20;
export const WINDOW_OPENING_SQFT = 15;
export const MIN_NET_WALL_AREA_SQFT = 50;

// Typical US room footprints (length x width, 8 ft ceiling) used when the views lack scale.
export const US_STANDARD_ROOM_SIZES = {
  bedroom: { lengthFt: 12, widthFt: 12, ceilingHeightFt: 8, label: "standard US bedroom" },
  primary_bedroom: { lengthFt: 14, widthFt: 16, ceilingHeightFt: 8, label: "standard US primary bedroom" },
  living_room: { lengthFt: 14, widthFt: 18, ceilingHeightFt: 8, label: "standard US living room" },
  family_room: { lengthFt: 16, widthFt: 20, ceilingHeightFt: 8, label: "standard US family room" },
  kitchen: { lengthFt: 10, widthFt: 12, ceilingHeightFt: 8, label: "standard US kitchen" },
  dining_room: { lengthFt: 12, widthFt: 14, ceilingHeightFt: 8, label: "standard US dining room" },
  bathroom: { lengthFt: 5, widthFt: 8, ceilingHeightFt: 8, label: "standard US full bathroom" },
  office: { lengthFt: 10, widthFt: 11, ceilingHeightFt: 8, label: "standard US home office" },
  hallway: { lengthFt: 4, widthFt: 12, ceilingHeightFt: 8, label: "standard US hallway" },
  laundry: { lengthFt: 6, widthFt: 8, ceilingHeightFt: 8, label: "standard US laundry room" },
  other: { lengthFt: 12, widthFt: 12, ceilingHeightFt: 8, label: "typical US room" },
} as const;

export type StandardRoomType = keyof typeof US_STANDARD_ROOM_SIZES;

export function normalizeRoomType(value: unknown): StandardRoomType {
  if (typeof value !== "string") return "other";
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key in US_STANDARD_ROOM_SIZES) return key as StandardRoomType;
  if (/master|primary/.test(key)) return "primary_bedroom";
  if (/bed|nursery|kids/.test(key)) return "bedroom";
  if (/living|lounge/.test(key)) return "living_room";
  if (/family|den|great|bonus/.test(key)) return "family_room";
  if (/kitchen/.test(key)) return "kitchen";
  if (/dining/.test(key)) return "dining_room";
  if (/bath|powder/.test(key)) return "bathroom";
  if (/office|study/.test(key)) return "office";
  if (/hall|corridor|entry|foyer/.test(key)) return "hallway";
  if (/laundry|mud|utility/.test(key)) return "laundry";
  return "other";
}

export function standardRoomDimensions(roomType: unknown) {
  return US_STANDARD_ROOM_SIZES[normalizeRoomType(roomType)];
}

export function openingDeductionSqFt(doorCount: number | null | undefined, windowCount: number | null | undefined) {
  const doors = Math.max(0, Math.round(doorCount ?? 0));
  const windows = Math.max(0, Math.round(windowCount ?? 0));
  return doors * DOOR_OPENING_SQFT + windows * WINDOW_OPENING_SQFT;
}

export function grossWallAreaSqFt(lengthFt: number, widthFt: number, ceilingHeightFt: number) {
  return 2 * (lengthFt + widthFt) * ceilingHeightFt;
}

export function netWallAreaSqFt(grossWallArea: number, openingDeduction: number) {
  return Math.max(MIN_NET_WALL_AREA_SQFT, grossWallArea - openingDeduction);
}

export { formatDimensionValue } from "./walkquote-estimate";

const ROOM_TYPE_NAMES: Record<StandardRoomType, string> = {
  bedroom: "Bedroom",
  primary_bedroom: "Primary bedroom",
  living_room: "Living room",
  family_room: "Family room",
  kitchen: "Kitchen",
  dining_room: "Dining room",
  bathroom: "Bathroom",
  office: "Home office",
  hallway: "Hallway",
  laundry: "Laundry room",
  other: "Room",
};

export function roomTypeName(roomType: unknown) {
  return ROOM_TYPE_NAMES[normalizeRoomType(roomType)];
}

/** Numbers repeated room names: ["Bedroom", "Bedroom"] -> ["Bedroom", "Bedroom 2"]. */
export function numberRoomLabels(labels: string[]) {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    return count === 1 ? label : `${label} ${count}`;
  });
}

/** Baseboard stops at doorways (about 3 ft each), never below half the perimeter. */
export function baseboardLengthFt(perimeterFt: number, doorCount: number | null | undefined) {
  const doors = Math.max(0, Math.round(doorCount ?? 0));
  return Math.max(perimeterFt / 2, perimeterFt - doors * 3);
}

export interface OpeningCrossCheck {
  status: "agree" | "muse_low" | "muse_high" | "unavailable";
  samMin: number;
  samMax: number;
  suggested: number | null;
}

/**
 * SAM 3.1 counts per frame bound the true count: at least the most seen in one view,
 * at most the sum across views (no overlap). Muse Spark outside that range is flagged.
 */
export function crossCheckOpeningCount(museCount: number | null | undefined, samPerFrameCounts: Array<number | null>): OpeningCrossCheck {
  const counts = samPerFrameCounts.filter((value): value is number => typeof value === "number");
  if (counts.length === 0) return { status: "unavailable", samMin: 0, samMax: 0, suggested: null };
  const samMin = Math.max(...counts);
  const samMax = counts.reduce((sum, value) => sum + value, 0);
  const muse = museCount ?? 0;
  if (muse < samMin) return { status: "muse_low", samMin, samMax, suggested: samMin };
  if (muse > samMax) return { status: "muse_high", samMin, samMax, suggested: samMax };
  return { status: "agree", samMin, samMax, suggested: muse };
}
