import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { AudioLines, Check, Cpu, Layers, Loader2, ScanSearch, X } from "lucide-react";
import { roomTypeName } from "@/lib/room-sizes";
import { SAM_CONCEPTS } from "@/lib/sam-concepts";
import type { AnalysisStatus, MaskData, ModelTrace, StageTiming } from "@/types/estimate";

export const MASK_LAYER_COLORS = { walls: "#2dd4bf", openings: "#60a5fa", trim: "#fbbf24" } as const;

const NOTE_SOURCE_LABELS: Record<ModelTrace["noteSource"], string> = {
  "video-audio": "Walkthrough video audio",
  "voice-note": "Recorded voice note",
  typed: "Typed note (no audio to transcribe)",
  none: "No room note",
};

function decodeBits(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

interface OverlayProps {
  walls: MaskData | null;
  openings?: MaskData | null;
  trim?: MaskData | null;
  alpha?: number;
}

/** Paints SAM 1-bit masks at mask resolution; CSS stretches the canvas over the frame. */
export const MaskOverlay = memo(function MaskOverlay({ walls, openings = null, trim = null, alpha = 120 }: OverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const base = walls ?? openings ?? trim;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !base) return;
    canvas.width = base.width;
    canvas.height = base.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rgba = context.createImageData(base.width, base.height);
    const layers: Array<[MaskData | null, string]> = [[walls, MASK_LAYER_COLORS.walls], [openings, MASK_LAYER_COLORS.openings], [trim, MASK_LAYER_COLORS.trim]];
    for (const [mask, color] of layers) {
      if (!mask) continue;
      const bits = decodeBits(mask.dataBase64);
      if (bits.length * 8 < mask.width * mask.height) continue;
      const [red, green, blue] = color.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16));
      const scaleX = mask.width / base.width;
      const scaleY = mask.height / base.height;
      for (let y = 0; y < base.height; y += 1) {
        const row = Math.min(mask.height - 1, Math.floor(y * scaleY)) * mask.width;
        for (let x = 0; x < base.width; x += 1) {
          const index = row + Math.min(mask.width - 1, Math.floor(x * scaleX));
          if ((bits[index >> 3] & (1 << (7 - (index & 7)))) === 0) continue;
          const offset = (y * base.width + x) * 4;
          rgba.data[offset] = red;
          rgba.data[offset + 1] = green;
          rgba.data[offset + 2] = blue;
          rgba.data[offset + 3] = alpha;
        }
      }
    }
    context.putImageData(rgba, 0, 0);
  }, [base, walls, openings, trim, alpha]);

  if (!base) return null;
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
});

function formatSeconds(ms: number) {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

/** Own interval so only the clock re-renders while a model is running. */
function StageClock({ timing, status }: { timing?: StageTiming; status: AnalysisStatus }) {
  const [now, setNow] = useState(() => Date.now());
  const running = status === "working" && Boolean(timing?.startedAt);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [running]);
  if (!timing?.startedAt) return <span className="font-mono text-xs tabular-nums text-slate-500">--.-s</span>;
  const end = running ? now : timing.endedAt ?? now;
  return <span className="font-mono text-xs tabular-nums text-slate-300" data-testid="model-stage-clock">{formatSeconds(end - timing.startedAt)}</span>;
}

const STATUS_STYLE: Record<AnalysisStatus, { label: string; tone: string }> = {
  pending: { label: "Queued", tone: "text-slate-400 border-slate-700" },
  working: { label: "Running", tone: "text-teal-300 border-teal-400/60" },
  done: { label: "Done", tone: "text-emerald-300 border-emerald-400/50" },
  skipped: { label: "Skipped", tone: "text-amber-300 border-amber-400/50" },
  error: { label: "Failed", tone: "text-rose-300 border-rose-400/60" },
};

function StatusPill({ status }: { status: AnalysisStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] ${style.tone}`}>
      {status === "working" ? <Loader2 size={11} className="animate-spin" /> : status === "done" ? <Check size={11} /> : status === "error" ? <X size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {style.label}
    </span>
  );
}

function ModelCard({ testId, icon, model, role, status, timing, children }: { testId: string; icon: ReactNode; model: string; role: string; status: AnalysisStatus; timing?: StageTiming; children: ReactNode }) {
  return (
    <article data-testid={testId} data-status={status} className={`flex min-w-0 flex-col rounded-2xl border bg-slate-900/70 p-4 transition-colors duration-300 ${status === "working" ? "border-teal-400/50 shadow-[0_0_0_1px_rgba(45,212,191,0.15),0_0_32px_-12px_rgba(45,212,191,0.6)]" : "border-slate-800"}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${status === "working" ? "bg-teal-400/15 text-teal-300" : "bg-slate-800 text-slate-300"}`}>{icon}</span>
          <div className="min-w-0"><p className="truncate font-mono text-sm font-semibold text-white">{model}</p><p className="truncate text-xs text-slate-400">{role}</p></div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1"><StatusPill status={status} /><StageClock timing={timing} status={status} /></div>
      </header>
      <div className="mt-4 min-w-0 flex-1 space-y-3 text-sm text-slate-300">{children}</div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><p className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p><div className="mt-1 min-w-0 text-slate-200">{children}</div></div>;
}

function Chip({ children, testId }: { children: ReactNode; testId?: string }) {
  return <span data-testid={testId} className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 font-mono text-xs text-slate-200">{children}</span>;
}

function Waiting({ status, working, idle }: { status: AnalysisStatus; working: string; idle: string }) {
  if (status === "working") return <p className="flex items-center gap-2 text-teal-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" />{working}</p>;
  return <p className="text-slate-500">{idle}</p>;
}

function VoiceCard({ trace, status }: { trace: ModelTrace; status: AnalysisStatus }) {
  const transcribed = trace.noteSource === "video-audio" || trace.noteSource === "voice-note";
  return (
    <ModelCard testId="model-card-voice" icon={<AudioLines size={18} />} model="muse-voice-transcribe-1.0" role="Muse Voice · spoken scope" status={status} timing={trace.stageTimings[0]}>
      <Field label="Input">{NOTE_SOURCE_LABELS[trace.noteSource]}</Field>
      <Field label="Output">
        {status === "done" && trace.transcript ? (
          <blockquote data-testid="model-voice-transcript" className="line-clamp-4 border-l-2 border-teal-400/60 pl-3 italic text-slate-100">“{trace.transcript}”</blockquote>
        ) : status === "skipped" ? (
          <p className="text-slate-400">{transcribed ? "No spoken words were heard, so the analysis continues from the images." : "Nothing to transcribe."}</p>
        ) : status === "error" ? (
          <p className="text-rose-300">Transcription stopped.</p>
        ) : (
          <Waiting status={status} working="Converting audio and transcribing…" idle="Waiting to start" />
        )}
      </Field>
      {transcribed && <p className="text-xs text-slate-500">Emails, phone numbers and addresses are removed before the text reaches the next model.</p>}
    </ModelCard>
  );
}

function SparkCard({ trace, status }: { trace: ModelTrace; status: AnalysisStatus }) {
  const { assessment } = trace;
  const size = assessment.suggestedDimensions;
  const counts: Array<[string, number | null | undefined]> = [
    ["walls", assessment.visibleWallCount],
    ["doors", assessment.visibleDoorCount],
    ["windows", assessment.visibleWindowCount],
    ["marks", assessment.visibleMarkCount],
  ];
  return (
    <ModelCard testId="model-card-spark" icon={<Cpu size={18} />} model="muse-spark-1.3" role="Muse Spark · room geometry & scale" status={status} timing={trace.stageTimings[1]}>
      <Field label="Input">{trace.frameCount} numbered views{trace.transcript ? " + room note" : ""}</Field>
      {status === "done" ? (
        <>
          <Field label="Room">
            <div className="flex flex-wrap gap-1.5">
              <Chip testId="model-spark-room-type">{roomTypeName(assessment.roomType)}</Chip>
              {counts.filter(([, value]) => typeof value === "number").map(([label, value]) => <Chip key={label}>{value} {value === 1 ? label.slice(0, -1) : label}</Chip>)}
              {assessment.wallTone !== "unknown" && <Chip>{assessment.wallTone} walls</Chip>}
            </div>
          </Field>
          {size && (
            <Field label="Scale reasoning">
              <p data-testid="model-spark-dimensions" className="font-mono text-base text-white">{size.lengthFt} × {size.widthFt} ft · {size.ceilingHeightFt} ft ceiling</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{size.basis}</p>
            </Field>
          )}
          {trace.observations.length > 0 && (
            <Field label="Observations">
              <ul className="space-y-1">{trace.observations.slice(0, 3).map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-xs leading-5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-300" />{item}</li>)}</ul>
            </Field>
          )}
        </>
      ) : (
        <Field label="Output">{status === "error" ? <p className="text-rose-300">The room review did not finish.</p> : <Waiting status={status} working="Matching walls across views and estimating scale…" idle="Waiting for the room note" />}</Field>
      )}
    </ModelCard>
  );
}

function SamCard({ trace, status, frameUrl }: { trace: ModelTrace; status: AnalysisStatus; frameUrl: string }) {
  const layers = [
    { id: "walls", label: "walls", mask: trace.wallMask, color: MASK_LAYER_COLORS.walls },
    { id: "openings", label: "openings", mask: trace.openingMask, color: MASK_LAYER_COLORS.openings },
    { id: "trim", label: "trim", mask: trace.trimMask, color: MASK_LAYER_COLORS.trim },
  ];
  const wallViews = trace.frameWallMasks.filter(Boolean).length;
  const doors = trace.samDoorCounts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const windows = trace.samWindowCounts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const hasMask = layers.some((layer) => layer.mask);
  return (
    <ModelCard testId="model-card-sam" icon={<ScanSearch size={18} />} model="sam-3.1" role="SAM 3.1 · wall & opening segmentation" status={status} timing={trace.stageTimings[2]}>
      <Field label="Concepts">
        <div className="flex flex-wrap gap-1.5">{SAM_CONCEPTS.map((concept) => <Chip key={concept}>{concept}</Chip>)}</div>
      </Field>
      {status === "done" && hasMask ? (
        <>
          {frameUrl && (
            <div className="relative overflow-hidden rounded-xl ring-1 ring-slate-700" data-testid="model-sam-overlay">
              <img src={frameUrl} alt="Analyzed frame with SAM 3.1 surface masks" className="block h-auto w-full" />
              <MaskOverlay walls={trace.wallMask} openings={trace.openingMask} trim={trace.trimMask} />
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {layers.map((layer) => layer.mask && <Chip key={layer.id}><span className="mr-1.5 h-2 w-2 rounded-sm" style={{ backgroundColor: layer.color }} />{layer.mask.regions.length} {layer.label}</Chip>)}
          </div>
          <p data-testid="model-sam-summary" className="text-xs leading-5 text-slate-400">Wall masks on {wallViews} of {trace.frameCount} views · {doors} door{doors === 1 ? "" : "s"} and {windows} window{windows === 1 ? "" : "s"} detected to cross-check Muse Spark's counts.</p>
        </>
      ) : (
        <Field label="Output">{status === "skipped" || (status === "done" && !hasMask) ? <p className="text-amber-200">No usable surface mask came back. The estimate continues without the color overlay.</p> : status === "error" ? <p className="text-rose-300">Segmentation stopped.</p> : <Waiting status={status} working={`Segmenting ${trace.frameCount} views, up to 3 requests at a time…`} idle="Waiting for the room review" />}</Field>
      )}
    </ModelCard>
  );
}

export function ModelInspector({ trace, statuses, frameUrl }: { trace: ModelTrace; statuses: AnalysisStatus[]; frameUrl: string }) {
  const starts = trace.stageTimings.map((timing) => timing?.startedAt).filter((value): value is number => typeof value === "number");
  const firstStart = starts.length ? Math.min(...starts) : undefined;
  const running = statuses.some((status) => status === "working");
  const lastEnd = Math.max(0, ...trace.stageTimings.map((timing) => timing?.endedAt ?? 0)) || undefined;
  return (
    <section data-testid="ai-at-work-panel" aria-labelledby="ai-at-work-heading" className="rounded-[1.8rem] border border-slate-800 bg-slate-950 p-4 text-white sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-teal-300"><Layers size={13} /> Meta Model API · live trace</p>
          <h2 id="ai-at-work-heading" className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">AI at work</h2>
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-400" aria-live="polite">
          Total <StageClock timing={firstStart ? { startedAt: firstStart, endedAt: lastEnd } : undefined} status={running ? "working" : "done"} />
        </p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <VoiceCard trace={trace} status={statuses[0] ?? "pending"} />
        <SparkCard trace={trace} status={statuses[1] ?? "pending"} />
        <SamCard trace={trace} status={statuses[2] ?? "pending"} frameUrl={frameUrl} />
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Each card shows the actual model output for your room. Masks mark image regions for the color preview and are not measurements.</p>
    </section>
  );
}
