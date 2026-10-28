import type { RoomEstimateRecord } from "@/entities";
import type { WalkthroughRecording } from "@/lib/room-media";

export type { RoomFrame } from "@/lib/room-media";

export type RoomId = "living" | "bedroom";
export type Screen = "setup" | "demo-inspector" | "capture" | "analysis" | "measurements" | "estimate" | "contact" | "complete";
export type CaptureMode = "video" | "photos";
export type ScopeId = "walls" | "ceiling" | "trim" | "doors" | "patch" | "primer";
export type ScopeSelections = Partial<Record<ScopeId, boolean>>;
export type AnalysisStatus = "pending" | "working" | "done" | "skipped" | "error";
export type WallTone = "dark" | "medium" | "light" | "unknown";
export type RoomShape = "rectangular" | "irregular_open_plan" | "square_footage_approximation";
export type EstimateSource = "doorway_scale" | "homeowner_entered_net_wall_area" | "demo";
export type DemoVideoSource = { kind: "video" | "embed"; src: string };

export interface PaintColor {
  name: string;
  hex: string;
}

export interface RoomDimensions {
  roomShape: RoomShape;
  lengthFt?: number;
  widthFt?: number;
  ceilingHeightFt?: number;
  grossWallArea?: number;
  openingDeductionSqFt: number | null;
  wallArea: number;
  ceilingArea?: number;
  trimLength?: number;
  perimeterFt?: number;
  doorSides?: number;
  patchCount?: number;
}

export interface SuggestedDimensions {
  lengthFt: number;
  widthFt: number;
  ceilingHeightFt: number;
  confidence: "low" | "medium";
  basis: string;
}

export interface RoomAssessment {
  visibleDoorCount: number | null;
  visibleWindowCount: number | null;
  visibleMarkCount: number | null;
  wallTone: WallTone;
  scaleReference: "standard_door" | "none";
  suggestedDimensions: SuggestedDimensions | null;
  openingDeductionSqFt: number | null;
}

export interface ScopeLine {
  id: ScopeId;
  label: string;
  detail: string;
  quantity: number;
  unit: string;
  rateLow: number;
  rateHigh: number;
  low: number;
  high: number;
  required: boolean;
  defaultIncluded: boolean;
}

export interface QuoteTotals {
  subtotalLow: number;
  subtotalHigh: number;
  taxLow: number;
  taxHigh: number;
  low: number;
  high: number;
}

export interface MaskRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MaskData {
  width: number;
  height: number;
  dataBase64: string;
  regions: MaskRegion[];
}

export interface AnalysisReply {
  error?: string;
  errorCode?: string;
  message?: string;
  resetsAt?: string;
  transcript?: string;
  observations?: string[];
  visibleDoorCount?: number | null;
  visibleWindowCount?: number | null;
  visibleMarkCount?: number | null;
  wallTone?: WallTone;
  scaleReference?: "standard_door" | "none";
  suggestedDimensions?: SuggestedDimensions | null;
  openingDeductionSqFt?: number | null;
  maskText?: string | null;
  trimMaskText?: string | null;
  openingMaskText?: string | null;
  segmentationUnavailable?: string[];
}

export interface UsageDiagnosticReply {
  ok: boolean;
  processMarker: string;
  connectionFingerprint: string | null;
}

export interface EstimateLead extends RoomEstimateRecord {
  id: string;
  created_at?: string;
  room_shape?: RoomShape;
  room_perimeter_ft?: number;
  gross_wall_area_sqft?: number;
  opening_deduction_sqft?: number;
  paintable_area_manually_edited?: boolean;
}

export interface CapturedVideoAsset extends WalkthroughRecording {
  previewUrl: string;
}

export interface CapturedAudioAsset {
  blob: Blob;
  previewUrl: string;
  mimeType: string;
  size: number;
}
