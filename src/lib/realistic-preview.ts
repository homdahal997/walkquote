import { decodeBase64Bytes } from "@/lib/walkquote-estimate";
import type { MaskData } from "@/types/estimate";

export const RENDER_EXPECTED_MS = 25_000;
export const RENDER_TIMEOUT_MS = 60_000;

export interface RenderProgress {
  percent: number;
  step: string;
  message: string;
}

/** Progress shown while Muse Image works: fills toward ~25s, then creeps so it never looks stalled. */
export function renderProgress(elapsedMs: number): RenderProgress {
  const elapsed = Math.max(0, elapsedMs);
  const percent = elapsed <= RENDER_EXPECTED_MS
    ? (elapsed / RENDER_EXPECTED_MS) * 90
    : 90 + (1 - Math.exp(-(elapsed - RENDER_EXPECTED_MS) / 15_000)) * 9;
  const step = elapsed < 4_000 ? "Sending room view" : elapsed < 20_000 ? "Repainting walls" : "Fitting to SAM 3.1 wall outline";
  const message = elapsed < RENDER_EXPECTED_MS
    ? "Muse Image 1.0 calculating lighting, sheen & texture (~20–25s)..."
    : "Almost there...";
  return { percent: Math.min(99, Math.round(percent * 10) / 10), step, message };
}

/** Eight lowercase hex chars; each preview request gets its own usage slot. */
export function newRenderId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("render-image-load"));
    image.src = src;
  });
}

export async function imageSize(src: string) {
  const image = await loadImage(src);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

/**
 * Keeps only wall pixels of the Muse Image result: the render is scaled onto the original frame
 * and cut with SAM 3.1's wall mask (softly feathered), leaving a transparent overlay elsewhere.
 */
export async function composeWallRender(originalUrl: string, renderUrl: string, mask: MaskData | null) {
  const [original, render] = await Promise.all([loadImage(originalUrl), loadImage(renderUrl)]);
  if (!mask) {
    // No SAM outline for this view: show Muse Image's full repaint, scaled onto the frame.
    const full = document.createElement("canvas");
    full.width = original.naturalWidth;
    full.height = original.naturalHeight;
    const ctx = full.getContext("2d");
    if (!ctx || !full.width || !full.height) throw new Error("render-canvas");
    ctx.drawImage(render, 0, 0, full.width, full.height);
    const fullBlob = await new Promise<Blob | null>((resolve) => full.toBlob(resolve, "image/png"));
    if (!fullBlob) throw new Error("render-canvas");
    return URL.createObjectURL(fullBlob);
  }
  const width = original.naturalWidth;
  const height = original.naturalHeight;
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = mask.width;
  maskCanvas.height = mask.height;
  const maskContext = maskCanvas.getContext("2d");
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const context = out.getContext("2d");
  if (!maskContext || !context || !width || !height) throw new Error("render-canvas");
  const bits = decodeBase64Bytes(mask.dataBase64);
  const alpha = maskContext.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.width * mask.height; index += 1) {
    if ((bits[index >> 3] & (1 << (7 - (index & 7)))) !== 0) alpha.data[index * 4 + 3] = 255;
  }
  maskContext.putImageData(alpha, 0, 0);
  context.drawImage(render, 0, 0, width, height);
  context.globalCompositeOperation = "destination-in";
  context.filter = "blur(1.5px)";
  context.imageSmoothingEnabled = true;
  context.drawImage(maskCanvas, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("render-canvas");
  return URL.createObjectURL(blob);
}
