import resultsAsset from "@/assets/family-room-meta-results.json.asset.json";
import videoAsset from "@/assets/family-room-walkthrough.mp4.asset.json";
import view1 from "@/assets/family-room-view-1.jpg.asset.json";
import view2 from "@/assets/family-room-view-2.jpg.asset.json";
import view3 from "@/assets/family-room-view-3.jpg.asset.json";
import view4 from "@/assets/family-room-view-4.jpg.asset.json";
import repaint1 from "@/assets/family-room-repaint-1.jpg.asset.json";
import repaint2 from "@/assets/family-room-repaint-2.jpg.asset.json";
import repaint3 from "@/assets/family-room-repaint-3.jpg.asset.json";
import repaint4 from "@/assets/family-room-repaint-4.jpg.asset.json";
import type { AnalysisReply, RoomFrame } from "@/types/estimate";

export const GOLDEN_VIDEO_URL = videoAsset.url;
export const GOLDEN_REPAINTS = [repaint1.url, repaint2.url, repaint3.url, repaint4.url];
export const GOLDEN_COLOR = { name: "Warm Linen", hex: "#eadcc4" };
export function canSubmitRoom(mode: "homeowner" | "demo", savedReplay: boolean) {
  return mode === "homeowner" && !savedReplay;
}
export interface GoldenRun {
  transcribe: AnalysisReply;
  observe: AnalysisReply;
  segment: AnalysisReply;
  provenance: { capturedAt: string; models: string[]; durationSeconds: number; timestamps: number[] };
}

/** Loads saved real model outputs only; replay never calls a model or saves a lead. */
export async function loadGoldenRun(): Promise<{ results: GoldenRun; frames: RoomFrame[] }> {
  const response = await fetch(resultsAsset.url);
  if (!response.ok) throw new Error("The saved demo could not be loaded. Please try again.");
  const results = await response.json() as GoldenRun;
  if (!results.observe?.suggestedDimensions || !Array.isArray(results.segment?.frameMaskTexts)) throw new Error("The saved demo is incomplete.");
  const frames = await Promise.all([view1, view2, view3, view4].map(async (asset, index) => {
    const image = await fetch(asset.url);
    if (!image.ok) throw new Error("A saved room view could not be loaded.");
    const blob = await image.blob();
    return { id: `golden-${index}`, blob, previewUrl: asset.url, mimeType: "image/jpeg" as const, size: blob.size, name: `Family room view ${index + 1}`, timestampSeconds: results.provenance.timestamps[index] };
  }));
  return { results, frames };
}