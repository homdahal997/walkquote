import type { RefObject } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Info,
  Mic,
  Palette,
  Sparkles,
} from "lucide-react";
import { BeforeAfterSlider } from "@/components/estimate/BeforeAfterSlider";
import { itemIsIncluded, moneyRange } from "@/lib/pricing";
import type { PaintColor, RoomId, ScopeLine, ScopeSelections } from "@/types/estimate";

export interface SampleRoom {
  id: RoomId;
  name: string;
  descriptor: string;
  image: string;
  alt: string;
  dimensions: string;
  lengthFt: number;
  widthFt: number;
  ceilingHeightFt: number;
  grossWallArea: number;
  openingDeductionSqFt: number | null;
  wallArea: number;
  ceilingArea: number;
  trimLength: number;
  doorSides: number;
  patchCount: number;
  darkWalls: boolean;
  visualClue: string;
  spokenCue: string;
  caution: string;
}

export interface DemoSpatialMath {
  doorHeightInches: number;
  scalePixelsPerInch: number;
}

const DEMO_WALL_MASK_PATH = [
  "M 0 78 L 1287 78 L 1287 706 L 0 706 Z",
  "M 76 172 H 332 V 546 H 76 Z",
  "M 373 172 H 629 V 546 H 373 Z",
  "M 946 171 H 1228 V 747 H 946 Z",
].join(" ");
const DEMO_WALL_TINT_PATH = `${DEMO_WALL_MASK_PATH} M 654 307 H 790 V 398 H 654 Z`;
const DEMO_WALL_OUTLINE_PATH = "M 0 78 L 1287 78 L 1287 706 L 0 706 Z";
const DEMO_BEDROOM_WALL_MASK_PATH = [
  "M 0 88 L 772 137 L 1400 70 L 1400 610 L 0 610 Z",
  "M 0 135 L 171 148 L 171 530 L 0 526 Z",
  "M 242 396 L 1035 399 L 1186 610 L 220 610 Z",
].join(" ");
const DEMO_BEDROOM_WALL_OUTLINE_PATH = "M 0 88 L 772 137 L 1400 70 L 1400 610 L 0 610 Z";

interface SampleDemoInspectorProps {
  motionProps: HTMLMotionProps<"section">;
  rooms: Record<RoomId, SampleRoom>;
  sampleRoomId: RoomId;
  activeRoom: SampleRoom;
  demoColors: readonly PaintColor[];
  demoSpatialMath: DemoSpatialMath;
  items: ScopeLine[];
  scopeSelection: ScopeSelections;
  color: PaintColor;
  split: number;
  masksVisible: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAnimationComplete: () => void;
  onSelectRoom: (roomId: RoomId) => void;
  onToggleMasks: () => void;
  onSelectColor: (color: PaintColor) => void;
  onSplit: (value: number) => void;
  onReviewQuote: () => void;
}

function formatDimensionValue(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function SampleRoomCard({
  room,
  selected,
  onSelect,
}: {
  room: SampleRoom;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`group overflow-hidden rounded-2xl border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${selected ? "border-teal-700 bg-teal-50 ring-2 ring-teal-700/20" : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-md"}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
        <img src={room.image} alt={room.alt} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        <span className="absolute left-3 top-3 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-950">Demo only</span>
        <span className={`absolute bottom-3 right-3 flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${selected ? "bg-teal-700 text-white" : "bg-white/95 text-slate-900"}`}>
          {selected ? <><Check size={14} /> Selected</> : "Choose room"}
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="text-xl font-semibold tracking-tight text-slate-950">{room.name}</h3>
        <p className="mt-1 text-base leading-6 text-slate-600">{room.descriptor}</p>
        <div className="mt-4 flex items-start justify-between gap-3 border-t border-slate-200 pt-3">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Illustrative size</span>
          <span className="text-right text-sm font-semibold tabular-nums text-slate-800">{room.dimensions}</span>
        </div>
      </div>
    </button>
  );
}

function SampleVisionFrame({ room, masksVisible }: { room: SampleRoom; masksVisible: boolean }) {
  const isLivingRoom = room.id === "living";
  return (
    <div className="relative aspect-[7/4] overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-900/10">
      <img src={room.image} alt={room.alt} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-slate-950/20" />
      {masksVisible && (
        <svg viewBox="0 0 1400 800" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {isLivingRoom ? (
            <>
              <path d={DEMO_WALL_MASK_PATH} fill="#3B82F6" fillOpacity="0.28" fillRule="evenodd" />
              <path d={DEMO_WALL_OUTLINE_PATH} fill="none" stroke="#60A5FA" strokeWidth="4" strokeDasharray="12 8" />
              <rect x="946" y="171" width="282" height="576" rx="4" fill="#A855F7" fillOpacity="0.12" stroke="#C084FC" strokeWidth="5" strokeDasharray="12 8" />
              <rect x="76" y="172" width="256" height="374" rx="4" fill="#FACC15" fillOpacity="0.12" stroke="#FDE047" strokeWidth="5" strokeDasharray="12 8" />
              <rect x="373" y="172" width="256" height="374" rx="4" fill="#FACC15" fillOpacity="0.12" stroke="#FDE047" strokeWidth="5" strokeDasharray="12 8" />
              <rect x="650" y="306" width="140" height="92" rx="4" fill="#EF4444" fillOpacity="0.1" stroke="#F87171" strokeWidth="5" />
              <path d="M 759 326 L 748 334 L 738 340 L 724 347 L 714 353 L 699 361 L 690 370 L 677 378" fill="none" stroke="#FCA5A5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : (
            <>
              <path d={DEMO_BEDROOM_WALL_MASK_PATH} fill="#0F766E" fillOpacity="0.2" fillRule="evenodd" />
              <path d={DEMO_BEDROOM_WALL_OUTLINE_PATH} fill="none" stroke="#5EEAD4" strokeWidth="4" strokeDasharray="12 8" />
              <rect x="0" y="132" width="172" height="398" rx="4" fill="#60A5FA" fillOpacity="0.1" stroke="#93C5FD" strokeWidth="5" strokeDasharray="12 8" />
              <rect x="0" y="605" width="1400" height="18" fill="#FACC15" fillOpacity="0.25" stroke="#FDE047" strokeWidth="4" />
              <ellipse cx="844" cy="87" rx="49" ry="13" fill="#EF4444" fillOpacity="0.18" stroke="#F87171" strokeWidth="4" strokeDasharray="10 7" />
            </>
          )}
        </svg>
      )}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-950/85 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-white"><span className="h-2 w-2 rounded-full bg-teal-300" /> Prepared sample frame</span>
        <span className="rounded-full bg-amber-300 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-950">Hand-placed demo overlays</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-white/20 bg-slate-950/80 px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-white">FRAME 01 / SAMPLE</div>
    </div>
  );
}

function SampleWallTintPreview({
  room,
  color,
  split,
  onSplit,
}: {
  room: SampleRoom;
  color: PaintColor;
  split: number;
  onSplit: (value: number) => void;
}) {
  const isLivingRoom = room.id === "living";
  const tintPath = isLivingRoom ? DEMO_WALL_TINT_PATH : DEMO_BEDROOM_WALL_MASK_PATH;
  const outlinePath = isLivingRoom ? DEMO_WALL_OUTLINE_PATH : DEMO_BEDROOM_WALL_OUTLINE_PATH;
  return (
    <div>
      <BeforeAfterSlider
        split={split}
        onSplit={onSplit}
        min={18}
        max={82}
        ariaLabel="Move the sample room before and after comparison"
        ariaValueText={`${split}% original image, ${100 - split}% ${color.name} preview`}
        beforeLabel="Before"
        afterLabel="After"
        stageClassName="wq-comparison-stage relative aspect-[7/4] overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-900/10"
        dividerClassName="shadow-[0_0_0_1px_rgba(15,23,42,0.35)]"
        handleClassName="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-slate-950/85 text-xl text-white shadow-lg"
        rangeClassName="mt-3 flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-700"
        rangeInputClassName="h-11 w-full accent-teal-700"
      >
        <>
          <img src={room.image} alt={room.alt} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          <svg viewBox="0 0 1400 800" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" style={{ clipPath: `inset(0 0 0 ${split}%)` }} aria-hidden="true">
            <path d={tintPath} fill={color.hex} fillOpacity="0.58" fillRule="evenodd" />
            <path d={outlinePath} fill="none" stroke={color.hex} strokeOpacity="0.85" strokeWidth="4" />
          </svg>
          <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between gap-3 text-xs font-bold uppercase tracking-[0.1em] text-white drop-shadow">
            <span className="rounded-full bg-slate-950/80 px-3 py-1.5">Before</span>
            <span className="rounded-full bg-slate-950/80 px-3 py-1.5">After · {color.name}</span>
          </div>
        </>
      </BeforeAfterSlider>
      <p className="mt-2 text-sm leading-5 text-slate-600">The color follows a hand-placed sample wall shape. It is a visual preview, not a finished-paint rendering or room measurement.</p>
    </div>
  );
}

export function SampleDemoInspector({
  motionProps,
  rooms,
  sampleRoomId,
  activeRoom,
  demoColors,
  demoSpatialMath,
  items,
  scopeSelection,
  color,
  split,
  masksVisible,
  headingRef,
  onAnimationComplete,
  onSelectRoom,
  onToggleMasks,
  onSelectColor,
  onSplit,
  onReviewQuote,
}: SampleDemoInspectorProps) {
  const wallLine = items.find((item) => item.id === "walls");
  const ceilingLine = items.find((item) => item.id === "ceiling");
  const trimLine = items.find((item) => item.id === "trim");
  const patchLine = items.find((item) => item.id === "patch");
  const ceilingIncluded = ceilingLine ? itemIsIncluded(ceilingLine, scopeSelection) : false;
  const trimIncluded = trimLine ? itemIsIncluded(trimLine, scopeSelection) : false;
  const patchIncluded = patchLine ? itemIsIncluded(patchLine, scopeSelection) : false;
  const wallQuantityLabel = wallLine ? `${formatDimensionValue(wallLine.quantity)} sq ft` : `${activeRoom.wallArea} sq ft`;
  const overlayLegend = activeRoom.id === "living"
    ? [
        { color: "#3B82F6", label: `Wall overlay · ${wallQuantityLabel} comes from this room preset, not mask pixels.` },
        { color: "#A855F7", label: `Doorway outline · illustrative ${demoSpatialMath.doorHeightInches}\" reference cue, not a confirmed measurement.` },
        { color: "#FACC15", label: `Two window outlines · sample opening deduction totals ${activeRoom.openingDeductionSqFt ?? 0} sq ft with the doorway.` },
        { color: "#EF4444", label: `Hairline crack cue · ${patchIncluded ? "a sample patch is included" : "shown as a visual clue only; repair is excluded"}.` },
      ]
    : [
        { color: "#0F766E", label: `Wall overlay · ${wallQuantityLabel} comes from this room preset, not mask pixels.` },
        { color: "#60A5FA", label: "Window outline · illustrative only; this room preset applies no opening deduction." },
        { color: "#FACC15", label: `Trim band · ${activeRoom.trimLength} ft in the preset; trim is ${trimIncluded ? "included" : "excluded"} from the current scope.` },
        { color: "#EF4444", label: `Ceiling mark · visual cue only, not a diagnosis. Ceiling paint is ${ceilingIncluded ? "included" : "excluded"}.` },
      ];

  return (
    <motion.section key="demo-inspector" className="space-y-6" onAnimationComplete={onAnimationComplete} {...motionProps}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Sample walkthrough · visual inspector</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-2 rounded text-3xl font-semibold tracking-tight text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 sm:text-4xl">See how a room becomes a quote.</h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">Review a prepared room frame, illustrative overlays, sample area math, and the way a written room note maps to line items.</p>
        </div>
        <span className="inline-flex max-w-full items-center gap-2 self-start rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950 sm:self-auto"><Info size={16} className="shrink-0" />Illustrative sample, not measured from your room</span>
      </div>

      <section className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="demo-room-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">Choose a sample room</p><h2 id="demo-room-heading" className="mt-1 text-xl font-semibold text-slate-950">Switch the room, then review its details.</h2></div>
          <p className="max-w-xl text-sm leading-5 text-slate-600">Each prepared room has its own illustrative notes, overlays, and sample quantities. Nothing here is measured from a visitor’s room.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="group" aria-label="Choose a sample room">
          {Object.values(rooms).map((room) => <SampleRoomCard key={room.id} room={room} selected={sampleRoomId === room.id} onSelect={() => onSelectRoom(room.id)} />)}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm" aria-labelledby="demo-vision-heading">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">01 · Prepared sample frame</p><h2 id="demo-vision-heading" className="mt-1 text-xl font-semibold text-slate-950">Illustrative sample overlays</h2></div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-teal-200"><Sparkles size={14} />Illustrative SVG overlays</span>
          </div>
          <div className="p-3 sm:p-4">
            <SampleVisionFrame room={activeRoom} masksVisible={masksVisible} />
            <button type="button" aria-pressed={masksVisible} onClick={onToggleMasks} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-800 transition hover:border-slate-500 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto">
              {masksVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}{masksVisible ? "Hide hand-placed overlays" : "Show hand-placed overlays"}
            </button>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Illustrative sample annotations">
              {overlayLegend.map((item) => <li key={item.label} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="mt-1.5 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" /><span className="text-sm font-medium leading-5 text-slate-800">{item.label}</span></li>)}
            </ul>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-950">This prepared frame uses hand-placed sample annotations. No model analyzed visitor media, and none of these values describe a real room.</p>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="demo-math-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">Spatial breakdown</p><h2 id="demo-math-heading" className="mt-1 text-xl font-semibold text-slate-950">Sample area math</h2></div>
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-amber-950">Illustrative only</span>
            </div>
            <dl className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"><dt className="text-sm font-medium text-slate-700">Gross wall area</dt><dd className="shrink-0 text-base font-bold tabular-nums text-slate-950">{activeRoom.grossWallArea} sq ft</dd></div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"><dt className="text-sm font-medium leading-5 text-slate-700">Opening deduction</dt><dd className="shrink-0 text-base font-bold tabular-nums text-rose-800">{activeRoom.openingDeductionSqFt === null ? "Not applied" : `−${activeRoom.openingDeductionSqFt} sq ft`}</dd></div>
              <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-4"><dt className="text-sm font-bold text-teal-950">Net paintable wall area · sample</dt><dd className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-teal-950">{activeRoom.wallArea} sq ft</dd></div>
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3"><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Ceiling height</span><strong className="mt-1 block text-lg tabular-nums text-slate-950">{activeRoom.ceilingHeightFt.toFixed(1)} ft</strong><span className="mt-1 block text-sm leading-5 text-slate-600">Illustrative room preset</span></div>
              <div className="rounded-xl border border-slate-200 p-3"><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Reference scale</span><strong className="mt-1 block text-lg tabular-nums text-slate-950">{activeRoom.id === "living" ? `${demoSpatialMath.scalePixelsPerInch} px/in` : "Not used"}</strong><span className="mt-1 block text-sm leading-5 text-slate-600">{activeRoom.id === "living" ? "Illustrative doorway cue" : "Bedroom sample preset"}</span></div>
            </div>
            <p className="mt-4 text-sm leading-5 text-slate-600">{activeRoom.openingDeductionSqFt !== null ? `The living-room preset applies a ${activeRoom.openingDeductionSqFt} sq ft sample deduction for one doorway and two windows.` : "The bedroom preset applies no opening deduction or reference scale."} These figures are prepared sample inputs, not computer-vision measurements.</p>
          </section>

          <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="demo-scope-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">02 · Room note → sample scope</p><h2 id="demo-scope-heading" className="mt-1 text-xl font-semibold text-slate-950">Prepared room note &amp; sample scope</h2></div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"><Mic size={14} aria-hidden="true" />Prepared text · no audio</span>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Sample room note</span><span className="text-xs font-semibold text-slate-500">No audio recorded</span></div>
              <blockquote className="mt-2 text-base font-medium leading-7 text-slate-900">“{activeRoom.spokenCue}”</blockquote>
            </div>
            <div className="mt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-base font-bold text-slate-900">Current sample line items</h3><span className="text-sm text-slate-600">Rates before tax</span></div>
              <ul className="mt-3 space-y-2">
                {items.map((item) => {
                  const included = itemIsIncluded(item, scopeSelection);
                  return <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"><span className="text-sm font-semibold leading-5 text-slate-800">{item.label} · {formatDimensionValue(item.quantity)} {item.unit}</span><span className={`rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${included ? "bg-teal-50 text-teal-950" : "bg-slate-100 text-slate-700"}`}>{included ? moneyRange(item.low, item.high) : "Excluded from sample scope"}</span></li>;
                })}
              </ul>
              <p className="mt-4 text-sm leading-5 text-slate-600">{activeRoom.caution}</p>
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="demo-color-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">03 · Finish preview</p><h2 id="demo-color-heading" className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Compare four colors on the sample wall.</h2><p className="mt-2 max-w-2xl text-base leading-6 text-slate-600">Move the split to compare the original image with a wall-only color tint.</p></div>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700"><Palette size={16} />{color.name}</span>
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
          <SampleWallTintPreview room={activeRoom} color={color} split={split} onSplit={onSplit} />
          <div>
            <p className="text-sm font-bold text-slate-900">Choose a paint color</p>
            <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-1" role="group" aria-label="Choose a sample wall color">
              {demoColors.map((choice) => {
                const active = color.name === choice.name && color.hex.toUpperCase() === choice.hex.toUpperCase();
                return <button key={choice.name} type="button" aria-pressed={active} onClick={() => onSelectColor({ name: choice.name, hex: choice.hex })} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition ${active ? "border-teal-800 bg-teal-50 text-slate-950 ring-1 ring-teal-700/20" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}><span className="h-7 w-7 shrink-0 rounded-full border border-slate-900/10" style={{ backgroundColor: choice.hex }} /><span className="min-w-0 flex-1 text-left">{choice.name}</span>{active && <Check size={15} className="text-teal-800" />}</button>;
              })}
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Preview note.</strong> The tint follows an illustrative wall polygon. The photo is a sample, and the preview is not a finished-paint rendering.</div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><p className="text-base font-bold text-teal-950">Ready to compare the sample quote?</p><p className="mt-1 text-sm leading-5 text-teal-900">The sample stays in this walkthrough. It creates no contact or room request.</p></div>
        <button type="button" onClick={onReviewQuote} className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-800 px-6 py-4 text-base font-bold text-white transition hover:bg-teal-900">Review Budget vs. Quote <ArrowRight size={17} /></button>
      </div>
    </motion.section>
  );
}
