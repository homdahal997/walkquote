import { useEffect, useMemo, useRef, useState } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
  Eye,
  FileImage,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { CaptureMode, MaskData, AnalysisStatus, ModelTrace, RoomFrame } from "@/types/estimate";
import { MaskOverlay, ModelInspector } from "@/components/estimate/ModelInspector";

const ANALYSIS_STEPS = [
  { title: "Transcribe the room note", detail: "Room-only spoken scope" },
  { title: "Read walls, trim and openings", detail: "Visible features across selected frames" },
  { title: "Create visual surface overlays", detail: "Walls, trim and openings, not measurements" },
  { title: "Prepare a price-book range", detail: "Uses doorway-supported quantities or your net wall-area estimate" },
] as const;

interface AnalysisProgressProps {
  motionProps: HTMLMotionProps<"section">;
  mode: "homeowner" | "demo";
  captureMode: CaptureMode;
  primaryImageUrl: string;
  primaryImageAlt: string;
  sampleRoomName?: string;
  reduceMotion: boolean | null;
  analysisBusy: boolean;
  currentAnalysisStep: number;
  analysisError: string;
  analysisStatuses: AnalysisStatus[];
  maskUnavailable: boolean;
  modelTrace?: ModelTrace;
  onRetryAnalysis?: () => void;
  retryLabel?: string;
  onBackToCapture: () => void;
}

function RetryButton({ onRetry, testId, label }: { onRetry: () => void; testId: string; label: string }) {
  return (
    <button type="button" data-testid={testId} onClick={onRetry} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto">
      <RotateCcw size={16} /> {label}
    </button>
  );
}

interface CapturedFrameViewerProps {
  captureMode: CaptureMode;
  primaryFrameIndex: number;
  primaryImageUrl: string;
  primaryImageAlt: string;
  activeRoomFrames: RoomFrame[];
  wallMask: MaskData | null;
  trimMask: MaskData | null;
  openingMask: MaskData | null;
  transcript: string;
  observations: string[];
  onBackToCapture: () => void;
}

function decodeBase64Bytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function AnalysisProgress({
  motionProps,
  mode,
  captureMode,
  primaryImageUrl,
  primaryImageAlt,
  sampleRoomName,
  reduceMotion,
  analysisBusy,
  currentAnalysisStep,
  analysisError,
  analysisStatuses,
  maskUnavailable,
  modelTrace,
  onRetryAnalysis,
  retryLabel = "Retry Analysis",
  onBackToCapture,
}: AnalysisProgressProps) {
  return (
    <motion.section key="analysis" className="space-y-6" {...motionProps}>
      <div className="max-w-3xl">
        <p className="max-sm:hidden text-xs font-bold uppercase tracking-[0.16em] text-teal-800">03 · Room analysis</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"><span className="sm:hidden">Checking your room.</span><span className="hidden sm:inline">Reading the room, one frame at a time.</span></h1>
        <p className="mt-2 text-base leading-6 text-slate-600 sm:leading-7"><span className="sm:hidden">Review the frame and confirm wall area before pricing.</span><span className="hidden sm:inline">AI describes visible clues and outlines wall pixels for the color preview. It does not turn a mask into square feet. You review the frame and confirm an approximate wall area before prices appear.</span></p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className={`relative self-start overflow-hidden rounded-[1.8rem] p-2 sm:p-5 ${mode === "homeowner" ? "bg-white sm:bg-slate-950" : "bg-slate-950 p-3 sm:p-5"}`}>
          {primaryImageUrl ? <div className="relative"><img src={primaryImageUrl} alt={primaryImageAlt} className={`block h-auto w-full rounded-2xl ${mode === "homeowner" ? "bg-slate-100 sm:bg-transparent" : ""}`} />{modelTrace && <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl transition-opacity duration-500" style={{ opacity: modelTrace.wallMask ? 1 : 0 }} data-testid="analysis-wall-overlay"><MaskOverlay walls={modelTrace.wallMask} alpha={105} /></div>}</div> : <div className={`grid aspect-video place-items-center rounded-2xl ${mode === "homeowner" ? "bg-slate-100 text-slate-700 sm:bg-slate-900 sm:text-slate-300" : "bg-slate-900 text-slate-300"}`}><Loader2 className="animate-spin" size={26} /></div>}
          <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-300 ${mode === "homeowner" ? "max-sm:hidden" : ""}`}><span>{mode === "demo" ? `Generated demo · ${sampleRoomName}` : captureMode === "video" ? "Selected video frames" : "Selected homeowner photos"}</span><span>Analysis only · no physical measurement</span></div>
          <div className={`pointer-events-none absolute left-7 top-7 h-7 w-7 border-l-2 border-t-2 border-teal-300 ${mode === "homeowner" ? "max-sm:hidden" : ""}`} />
          <div className={`pointer-events-none absolute right-7 top-7 h-7 w-7 border-r-2 border-t-2 border-teal-300 ${mode === "homeowner" ? "max-sm:hidden" : ""}`} />
          <motion.div className={`pointer-events-none absolute left-6 right-6 top-1/2 h-px bg-teal-300/70 shadow-[0_0_20px_rgba(94,234,212,0.8)] ${mode === "homeowner" ? "max-sm:hidden" : ""}`} animate={analysisBusy && !reduceMotion ? { y: [-70, 70, -70] } : { y: 0 }} transition={{ duration: 3.2, repeat: analysisBusy && !reduceMotion ? Infinity : 0, ease: "easeInOut" }} />
        </div>
        {mode === "homeowner" && <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:hidden" aria-live="polite">
          {analysisError ? (
            <>
              <p className="flex items-center gap-2 text-base font-semibold text-rose-900"><CircleAlert size={18} /> Analysis stopped</p>
              <p className="mt-2 text-base leading-6 text-slate-700" role="alert">{analysisError}</p>
              {!analysisBusy && <div className="mt-4 grid gap-2">{onRetryAnalysis && <RetryButton onRetry={onRetryAnalysis} label={retryLabel} testId="retry-analysis-btn-mobile" />}<button type="button" onClick={onBackToCapture} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50">Back to capture <ArrowLeft size={16} /></button></div>}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                <span className="inline-flex items-center gap-2">{analysisBusy ? <Loader2 size={16} className="animate-spin text-teal-800" /> : <CheckCircle2 size={16} className="text-teal-800" />}{analysisBusy ? ANALYSIS_STEPS[currentAnalysisStep].title : "Preparing your review"}</span>
                <span className="shrink-0 tabular-nums">{Math.min(currentAnalysisStep + 1, ANALYSIS_STEPS.length)} of {ANALYSIS_STEPS.length}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Room analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={analysisBusy ? Math.round(((currentAnalysisStep + 0.45) / ANALYSIS_STEPS.length) * 100) : 0}>
                <div className="h-full rounded-full bg-teal-800 transition-[width] duration-300" style={{ width: `${analysisBusy ? Math.round(((currentAnalysisStep + 0.45) / ANALYSIS_STEPS.length) * 100) : 0}%` }} />
              </div>
            </>
          )}
        </div>}
        <div className={`${mode === "homeowner" ? "max-sm:hidden" : ""} rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6`}>
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-800"><Sparkles size={22} /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Live analysis</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{analysisBusy ? ANALYSIS_STEPS[currentAnalysisStep].title : analysisError ? "Analysis paused" : "Preparing your review"}</h2></div></div>
          <ol className="mt-6 space-y-3">
            {ANALYSIS_STEPS.map((step, index) => {
              const status = analysisStatuses[index];
              return <li key={step.title} className={`flex items-start gap-3 rounded-xl border p-3 ${status === "working" ? "border-teal-300 bg-teal-50" : status === "done" ? "border-emerald-200 bg-emerald-50" : status === "error" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${status === "done" ? "bg-emerald-700 text-white" : status === "working" ? "bg-teal-800 text-white" : status === "error" ? "bg-rose-700 text-white" : "bg-white text-slate-500"}`}>{status === "done" ? <Check size={14} /> : status === "working" ? <Loader2 size={14} className="animate-spin" /> : status === "error" ? <X size={14} /> : status === "skipped" ? "–" : `0${index + 1}`}</span>
                <span><strong className="block text-sm text-slate-950">{step.title}</strong><small className="mt-0.5 block text-sm leading-5 text-slate-600">{status === "skipped" ? index === 0 ? modelTrace?.voiceFailed ? "Transcription unavailable, continuing with the images" : "No voice note, or no spoken words were heard" : "Optional surface overlay unavailable" : status === "done" ? "Complete" : status === "working" ? step.detail : step.detail}</small></span>
              </li>;
            })}
          </ol>
          {analysisError ? <div className="mt-5 flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-900" role="alert"><CircleAlert size={17} className="mt-0.5 shrink-0" /><p>{analysisError}</p></div> : <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-slate-600"><Info size={16} className="mt-0.5 shrink-0" />Visible marks are observations only. A contractor checks surface conditions in person.</p>}
          {maskUnavailable && !analysisError && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-950">The wall outline could not be prepared. The estimate can continue without a wall-color overlay.</p>}
          {!analysisBusy && analysisError && (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {onRetryAnalysis && <RetryButton onRetry={onRetryAnalysis} label={retryLabel} testId="retry-analysis-btn" />}
              <button type="button" onClick={onBackToCapture} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50">Back to capture <ArrowLeft size={16} /></button>
            </div>
          )}
          {analysisBusy && <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-900"><Loader2 size={16} className="animate-spin" /> Waiting for analysis results</p>}
        </div>
      </div>
      {modelTrace && <ModelInspector trace={modelTrace} statuses={analysisStatuses} frameUrl={primaryImageUrl} />}
    </motion.section>
  );
}

export function CapturedFrameViewer({
  captureMode,
  primaryFrameIndex,
  primaryImageUrl,
  primaryImageAlt,
  activeRoomFrames,
  wallMask,
  trimMask,
  openingMask,
  transcript,
  observations,
  onBackToCapture,
}: CapturedFrameViewerProps) {
  return (
    <section className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="live-frame-review-heading">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800"><Eye size={21} /></span>
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Your submitted media</p><h2 id="live-frame-review-heading" className="mt-1 text-xl font-semibold text-slate-950">Actual analysis frame</h2><p className="mt-1 text-sm leading-5 text-slate-600">The colored regions, when available, match this frame and do not measure area.</p></div>
      </div>
      {primaryImageUrl ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">{captureMode === "video" ? `Frame ${primaryFrameIndex + 1} · visual overlay frame` : `Photo ${primaryFrameIndex + 1} · visual overlay frame`}</p>
          <SegmentationPreview imageUrl={primaryImageUrl} imageAlt={primaryImageAlt} wallMask={wallMask} trimMask={trimMask} openingMask={openingMask} />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5" role="alert">
          <p className="flex items-start gap-2 text-base font-semibold leading-6 text-rose-950"><CircleAlert size={18} className="mt-0.5 shrink-0" />No analyzed room frame is available to review.</p>
          <p className="mt-2 text-sm leading-6 text-rose-900">Return to capture and add three or four clear photos or record a new walkthrough. The quote cannot continue without reviewable room media.</p>
          <button type="button" onClick={onBackToCapture} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-bold text-rose-950 hover:bg-rose-100"><ArrowLeft size={15} /> Back to capture</button>
        </div>
      )}
      {activeRoomFrames.length > 1 && <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-900">Other submitted views</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {activeRoomFrames.map((frame, index) => index === primaryFrameIndex ? null : (
            <figure key={frame.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
              {frame.previewUrl ? <img src={frame.previewUrl} alt={`${captureMode === "video" ? "Walkthrough frame" : "Room photo"} ${index + 1}`} className="block h-auto w-full object-contain" /> : <div className="grid aspect-video place-items-center text-slate-300"><FileImage size={20} /></div>}
              <figcaption className="px-3 py-2 text-xs font-semibold text-slate-200">{captureMode === "video" ? `Frame ${index + 1}` : `Photo ${index + 1}`}</figcaption>
            </figure>
          ))}
        </div>
      </div>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Room note</p>
          {transcript ? <blockquote className="mt-2 text-sm leading-6 text-slate-800">“{transcript}”</blockquote> : <p className="mt-2 text-sm leading-6 text-slate-600">No spoken room note was returned.</p>}
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Visual observations</p>
          {observations.length ? <ul className="mt-2 space-y-2">{observations.map((observation, index) => <li key={`${observation}-${index}`} className="flex gap-2 text-sm leading-6 text-slate-800"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700" />{observation}</li>)}</ul> : <p className="mt-2 text-sm leading-6 text-slate-600">No visual observations were returned. The submitted images remain available for contractor review.</p>}
        </div>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950"><Info size={16} className="mt-0.5 shrink-0" />Masks and boxes mark image regions only. They do not provide square footage or physical dimensions.</p>
    </section>
  );
}

function SegmentationPreview({
  imageUrl,
  imageAlt,
  wallMask,
  trimMask,
  openingMask,
}: {
  imageUrl: string;
  imageAlt: string;
  wallMask: MaskData | null;
  trimMask: MaskData | null;
  openingMask: MaskData | null;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState({ walls: true, trim: true, openings: true });
  const layers = useMemo(() => [
    { id: "walls" as const, label: "Walls", color: "#14b8a6", mask: wallMask },
    { id: "trim" as const, label: "Trim", color: "#f59e0b", mask: trimMask },
    { id: "openings" as const, label: "Openings", color: "#60a5fa", mask: openingMask },
  ].filter((layer) => layer.mask !== null) as Array<{
    id: "walls" | "trim" | "openings";
    label: string;
    color: string;
    mask: MaskData;
  }>, [wallMask, trimMask, openingMask]);

  useEffect(() => {
    setImageReady(false);
  }, [imageUrl]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!imageReady || !image?.naturalWidth || !image.naturalHeight || !canvas) return;

    const width = image.naturalWidth;
    const height = image.naturalHeight;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);

    for (const layer of layers) {
      if (!visibleLayers[layer.id]) continue;
      const packed = decodeBase64Bytes(layer.mask.dataBase64);
      if (packed.length * 8 < layer.mask.width * layer.mask.height) continue;

      const layerCanvas = document.createElement("canvas");
      layerCanvas.width = width;
      layerCanvas.height = height;
      const layerContext = layerCanvas.getContext("2d");
      if (!layerContext) continue;
      const rgba = layerContext.createImageData(width, height);
      const [red, green, blue] = layer.color.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16));
      const scaleX = layer.mask.width / width;
      const scaleY = layer.mask.height / height;

      for (let y = 0; y < height; y += 1) {
        const maskY = Math.min(layer.mask.height - 1, Math.floor(y * scaleY));
        for (let x = 0; x < width; x += 1) {
          const maskX = Math.min(layer.mask.width - 1, Math.floor(x * scaleX));
          const maskIndex = maskY * layer.mask.width + maskX;
          if ((packed[maskIndex >> 3] & (1 << (7 - (maskIndex & 7)))) === 0) continue;
          const imageIndex = (y * width + x) * 4;
          rgba.data[imageIndex] = red;
          rgba.data[imageIndex + 1] = green;
          rgba.data[imageIndex + 2] = blue;
          rgba.data[imageIndex + 3] = 118;
        }
      }
      layerContext.putImageData(rgba, 0, 0);
      context.drawImage(layerCanvas, 0, 0);

      const fontSize = Math.max(12, Math.round(width / 58));
      context.font = `700 ${fontSize}px sans-serif`;
      context.lineWidth = Math.max(2, width / 500);
      context.strokeStyle = layer.color;
      context.fillStyle = layer.color;
      layer.mask.regions.slice(0, 8).forEach((region, index) => {
        const left = region.left * (width / layer.mask.width);
        const top = region.top * (height / layer.mask.height);
        const right = region.right * (width / layer.mask.width);
        const bottom = region.bottom * (height / layer.mask.height);
        const boxWidth = right - left;
        const boxHeight = bottom - top;
        if (boxWidth <= 0 || boxHeight <= 0) return;
        context.strokeRect(left, top, boxWidth, boxHeight);
        const label = `${layer.label} ${index + 1}`;
        const labelHeight = fontSize + 10;
        const labelY = Math.max(0, top - labelHeight);
        context.fillRect(left, labelY, context.measureText(label).width + 12, labelHeight);
        context.fillStyle = "#0f172a";
        context.fillText(label, left + 6, labelY + fontSize + 1);
        context.fillStyle = layer.color;
      });
    }
  }, [imageReady, layers, visibleLayers]);

  return (
    <div className="space-y-3">
      <div className={`relative mx-auto overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-900/10 ${imageReady ? "" : "aspect-video"}`}>
        <img ref={imageRef} src={imageUrl} alt={imageAlt} onLoad={() => setImageReady(true)} onError={() => setImageReady(false)} className="pointer-events-none block h-auto w-full select-none" />
        {imageReady && layers.length > 0 && <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />}
        <span className="absolute left-3 top-3 rounded-full bg-slate-950/85 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-white">AI region review · not to scale</span>
      </div>
      {layers.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show or hide suggested room regions">
          {layers.map((layer) => (
            <button key={layer.id} type="button" aria-pressed={visibleLayers[layer.id]} onClick={() => setVisibleLayers((current) => ({ ...current, [layer.id]: !current[layer.id] }))} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${visibleLayers[layer.id] ? "border-slate-400 bg-white text-slate-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: layer.color }} />{layer.label}{layer.mask.regions.length > 0 ? ` · ${layer.mask.regions.length}` : ""}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm leading-5 text-slate-700">Surface overlays were unavailable for this image. The original remains available for review.</p>
      )}
      <p className="text-sm leading-5 text-slate-600">Colored masks and boxes are model-suggested visual regions, not physical measurements. Check the original before relying on them.</p>
    </div>
  );
}
