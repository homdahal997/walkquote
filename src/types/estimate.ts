import type { RoomEstimateRecord } from "@/entities";
import type { WalkthroughRecording } from "@/lib/room-media";

export type { RoomFrame } from "@/lib/room-media";

export type RoomId = "living" | "bedroom";
export type Screen = "setup" | "demo-inspector" | "capture" | "analysis" | "measurements" | "estimate" | "contact" | "complete";
export type CaptureMode = "video" | "photos";
export type ScopeId = "walls" | "ceiling" | "trim" | "crown" | "doors" | "patch" | "primer";
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

export type PrepNeed = "nail_holes" | "scuffs" | "trim_caulking" | "furniture_masking";

export interface ArchitecturalFeatures {
  crownMoldingPresent: boolean;
  baseboardStyle: "standard" | "tall_decorative" | "none" | "unknown";
  doorCasingStyle: "standard" | "wide_decorative" | "cased_opening" | "none";
  ceilingType: "flat" | "textured" | "vaulted_high" | "standard";
  wallTexture: "smooth" | "textured" | "unknown";
  prepNeeds: PrepNeed[];
}

export interface EvidenceBadge {
  model: "Muse Spark 1.3" | "SAM 3.1" | "Muse Spark + SAM 3.1";
  detail: string;
}

export interface RoomAssessment {
  architecturalFeatures?: ArchitecturalFeatures | null;
  visibleDoorCount: number | null;
  visibleWindowCount: number | null;
  visibleMarkCount: number | null;
  wallTone: WallTone;
  scaleReference: "standard_door" | "none";
  suggestedDimensions: SuggestedDimensions | null;
  openingDeductionSqFt: number | null;
  roomType?: string;
  visibleWallCount?: number | null;
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
  evidenceBadge?: EvidenceBadge;
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

export interface StageTiming {
  startedAt?: number;
  endedAt?: number;
}

export type NoteSource = "video-audio" | "voice-note" | "typed" | "none";

/** Live outputs of each Meta model, shown in the analysis inspector as they arrive. */
export interface ModelTrace {
  noteSource: NoteSource;
  frameCount: number;
  transcript: string;
  observations: string[];
  assessment: RoomAssessment;
  wallMask: MaskData | null;
  trimMask: MaskData | null;
  openingMask: MaskData | null;
  frameWallMasks: Array<MaskData | null>;
  samDoorCounts: Array<number | null>;
  samWindowCounts: Array<number | null>;
  stageTimings: StageTiming[];
  voiceFailed?: boolean;
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
  roomType?: string;
  visibleWallCount?: number | null;
  architecturalFeatures?: ArchitecturalFeatures | null;
  maskText?: string | null;
  frameMaskTexts?: Array<string | null>;
  primaryFrameIndex?: number;
  samDoorCounts?: Array<number | null>;
  samWindowCounts?: Array<number | null>;
  trimMaskText?: string | null;
  openingMaskText?: string | null;
  segmentationUnavailable?: string[];
  renderImage?: string;
  renderModel?: string;
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
