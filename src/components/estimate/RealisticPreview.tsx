import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { analyzeRoom } from "@/functions";
import { composeWallRender, imageSize, newRenderId, renderProgress, RENDER_TIMEOUT_MS } from "@/lib/realistic-preview";
import type { AnalysisReply, MaskData, PaintColor } from "@/types/estimate";

export interface RenderSource {
  attemptId: string;
  frameDataUrls: string[];
}

export type RealisticRenderState =
  | { status: "idle" }
  | { status: "working"; startedAt: number }
  | { status: "done"; startedAt: number; endedAt: number; overlayUrl: string }
  | { status: "error"; startedAt: number; endedAt: number; message: string };

const TIMEOUT_MESSAGE = "Muse Image is taking longer than usual. Your color tint preview is still showing. Try again.";

/** Requests one Muse Image wall repaint per tap and caches it by view and color. */
export function useRealisticPreview({ source, frameIndex, originalUrl, mask, color }: {
  source: RenderSource | null | undefined;
  frameIndex: number;
  originalUrl: string;
  mask: MaskData | null;
  color: PaintColor;
}) {
  const key = `${source?.attemptId ?? ""}:${frameIndex}:${color.hex.toUpperCase()}`;
  const [state, setState] = useState<RealisticRenderState>({ status: "idle" });
  const cache = useRef(new Map<string, Extract<RealisticRenderState, { status: "done" }>>());
  const requestRef = useRef(0);
  const frame = source?.frameDataUrls[frameIndex];
  const available = Boolean(source && frame && originalUrl);

  // A new color or view cancels any running request and shows the button (or a cached render).
  useEffect(() => {
    requestRef.current += 1;
    setState(cache.current.get(key) ?? { status: "idle" });
  }, [key]);

  useEffect(() => () => {
    requestRef.current += 1;
    cache.current.forEach((entry) => URL.revokeObjectURL(entry.overlayUrl));
  }, []);

  const start = useCallback(async () => {
    if (state.status === "working" || !source || !frame || !originalUrl) return;
    const id = ++requestRef.current;
    const startedAt = Date.now();
    setState({ status: "working", startedAt });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { width, height } = await imageSize(originalUrl);
      const request = analyzeRoom({
        stage: "render",
        sourceId: "homeowner",
        attemptId: source.attemptId,
        frame,
        colorHex: color.hex.toUpperCase(),
        colorName: color.name,
        size: `${width}x${height}`,
        renderId: newRenderId(),
      }) as Promise<AnalysisReply>;
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("render-timeout")), RENDER_TIMEOUT_MS); });
      const reply = await Promise.race([request, timeout]);
      if (id !== requestRef.current) return;
      if (!reply || reply.error || typeof reply.renderImage !== "string") throw new Error(reply?.message ?? reply?.error ?? "The realistic preview did not finish. Please retry.");
      const overlayUrl = await composeWallRender(originalUrl, reply.renderImage, mask);
      if (id !== requestRef.current) {
        URL.revokeObjectURL(overlayUrl);
        return;
      }
      const done = { status: "done" as const, startedAt, endedAt: Date.now(), overlayUrl };
      cache.current.set(key, done);
      setState(done);
    } catch (caught) {
      if (id !== requestRef.current) return;
      const raw = caught instanceof Error ? caught.message : "";
      const message = raw === "render-timeout" ? TIMEOUT_MESSAGE : raw && !raw.startsWith("render-") ? raw : "The realistic preview did not finish. Your color tint preview is still showing.";
      setState({ status: "error", startedAt, endedAt: Date.now(), message });
    } finally {
      clearTimeout(timer);
    }
  }, [state.status, source, frame, mask, originalUrl, color.hex, color.name, key]);

  return { state, start, available };
}

/** Ticks once a second so the wait never looks stalled. */
export function RenderProgressPanel({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed = now - startedAt;
  const progress = renderProgress(elapsed);
  return (
    <div data-testid="realistic-preview-progress" className="mt-3 rounded-xl border border-emerald-700/30 bg-slate-950 p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="animate-pulse text-emerald-300" aria-hidden="true" />{progress.message}</p>
        <span data-testid="realistic-preview-elapsed" aria-hidden="true" className="font-mono text-sm tabular-nums text-emerald-200">{Math.floor(elapsed / 1000)}s</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-1000 ease-linear" style={{ width: `${progress.percent}%` }} />
      </div>
      <p role="status" aria-live="polite" data-testid="realistic-preview-step" className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-slate-400">{progress.step}</p>
    </div>
  );
}

export function RealisticPreviewControls({ state, onStart, colorName, hasWallMask = true }: { state: RealisticRenderState; onStart: () => void; colorName: string; hasWallMask?: boolean }) {
  if (state.status === "working") return <RenderProgressPanel startedAt={state.startedAt} />;
  if (state.status === "done") {
    return <p data-testid="realistic-preview-label" className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-700/30 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-emerald-200"><Sparkles size={13} aria-hidden="true" />Rendered by Muse Image{hasWallMask ? " · walls bounded by SAM 3.1" : " · full-image repaint"}</p>;
  }
  return (
    <div className="mt-3">
      {state.status === "error" && <p data-testid="realistic-preview-error" role="alert" className="mb-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-5 text-amber-950">{state.message}</p>}
      <button type="button" data-testid={state.status === "error" ? "realistic-preview-retry" : "realistic-preview-button"} onClick={onStart} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
        {state.status === "error" ? <RotateCcw size={16} aria-hidden="true" /> : <Sparkles size={16} className="text-emerald-300" aria-hidden="true" />}
        {state.status === "error" ? "Retry realistic preview" : `See it realistically in ${colorName}`}
      </button>
      {state.status === "idle" && <p className="mt-2 text-xs leading-5 text-slate-500">Muse Image repaints the walls in about 25 seconds. {hasWallMask ? "SAM 3.1's wall outline keeps the change on wall pixels only." : "No wall outline is available for this view; the full edited image will be shown and other details may change."}</p>}
    </div>
  );
}
