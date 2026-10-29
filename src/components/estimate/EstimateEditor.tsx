import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { RoomSizeAdjuster } from "@/components/estimate/RoomSizeAdjuster";
import type { OpeningCrossCheck } from "@/lib/room-sizes";
import { motion, type HTMLMotionProps } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  DoorOpen,
  Info,
  Pencil,
  Ruler,
  ShieldCheck,
  Sparkles,
  } from "lucide-react";
import { BeforeAfterSlider } from "@/components/estimate/BeforeAfterSlider";
import { CapturedFrameViewer } from "@/components/estimate/AnalysisProgress";
import type { SampleRoom } from "@/components/estimate/SampleDemoInspector";
import {
  budgetStatusLabel,
  itemIsIncluded,
  money,
  moneyRange,
  PRICE_BOOK,
  statusForBudget,
} from "@/lib/pricing";
import {
  BUDGET_CHOICES,
  COLORS,
  colorFromHex,
  DEMO_BEDROOM_WALL_MASK_PATH,
  DEMO_BEDROOM_WALL_OUTLINE_PATH,
  DEMO_COLORS,
  DEMO_WALL_OUTLINE_PATH,
  DEMO_WALL_TINT_PATH,
  ROOMS,
  decodeBase64Bytes,
  formatDimensionValue,
  hasDoorScopeCue,
  hasPatchScopeCue,
  measurementSourceLabel,
  roomDimensionsLabel,
} from "@/lib/walkquote-estimate";
import type {
  CaptureMode,
  EstimateSource,
  MaskData,
  PaintColor,
  RoomAssessment,
  RoomDimensions,
  RoomFrame,
  RoomId,
  Screen,
  ScopeLine,
  ScopeSelections,
  QuoteTotals,
} from "@/types/estimate";

export interface EstimateEditorMeasurementFields {
  lengthFt: string;
  widthFt: string;
  perimeterFt: string;
  ceilingAreaSqFt: string;
  ceilingHeightFt: string;
  doorSides: string;
  patchCount: string;
}

export interface EstimateEditorState {
  mode: "homeowner" | "demo";
  captureMode: CaptureMode;
  sampleRoom: SampleRoom | null;
  dimensions: RoomDimensions | null;
  measurementConfirmed: boolean;
  measurementFields: EstimateEditorMeasurementFields;
  measurementError: string;
  activeRoomFrames: RoomFrame[];
  primaryFrameIndex: number;
  primaryImageUrl: string;
  primaryImageAlt: string;
  mask: MaskData | null;
  trimMask: MaskData | null;
  openingMask: MaskData | null;
  transcript: string;
  observations: string[];
  assessment: RoomAssessment;
  onAdjustCount?: (key: "visibleDoorCount" | "visibleWindowCount", delta: number) => void;
  updateRoomSize?: (key: "lengthFt" | "widthFt" | "ceilingHeightFt", value: string) => void;
  quoteActions?: ReactNode;
  estimateSource: EstimateSource;
  manualWallAreaOverride: number | null;
  wallAreaEditing: boolean;
  wallAreaDraft: string;
  wallAreaEditError: string;
  budgetAmount: number | null;
  budgetLabel: string;
  budgetIsCustom: boolean;
  budgetSliderValue: number;
  color: PaintColor;
  colorHexDraft: string;
  colorHexError: string;
  split: number;
  demoHeadingRef: RefObject<HTMLHeadingElement | null>;
  items: ScopeLine[];
  scopeSelection: ScopeSelections;
  scopeMessage: string;
  includedItems: ScopeLine[];
  totals: QuoteTotals;
  budgetStatus: ReturnType<typeof statusForBudget>;
  budgetCoverage: number;
  scopeFollowUpsOpen: boolean;
  doorScopeSelected: boolean;
  patchScopeSelected: boolean;
  frameWallMasks?: Array<MaskData | null>;
  openingChecks?: { doors: OpeningCrossCheck; windows: OpeningCrossCheck };
}

export interface EstimateEditorHandlers {
  onScreenChange: (screen: Screen) => void;
  backFromEstimate: () => void;
  setDemoDimensions: () => void;
  startWallAreaEdit: () => void;
  saveWallAreaEdit: () => boolean;
  cancelWallAreaEdit: () => void;
  useCalculatedWallArea: () => void;
  onAreaReviewWallAreaDraftChange: (value: string) => void;
  onEstimateWallAreaDraftChange: (value: string) => void;
  continueFromAreaReview: () => void;
  chooseBudget: (amount: number | null, label: string) => void;
  handleBudgetSlider: (value: string) => void;
  chooseWallColor: (nextColor: PaintColor) => void;
  updateWallColorFromHex: (value: string) => void;
  fitBudget: () => void;
  toggleScope: (item: ScopeLine) => void;
  toggleScopeFollowUps: () => void;
  updateDoorScopeSelection: (selected: boolean) => void;
  updatePatchScopeSelection: (selected: boolean) => void;
  updateMeasurement: (key: keyof EstimateEditorMeasurementFields, value: string) => void;
  setSplit: (value: number) => void;
  continueToContact: () => void;
  focusDemoHeading: () => void;
}

export interface EstimateEditorProps {
  screen: "measurements" | "estimate";
  motionProps: HTMLMotionProps<"section">;
  reduceMotion: boolean | null;
  state: EstimateEditorState;
  handlers: EstimateEditorHandlers;
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
            <span className="rounded-full bg-slate-950/80 px-3 py-1.5">Original Room</span>
            <span className="rounded-full bg-slate-950/80 px-3 py-1.5">Color Preview · {color.name}</span>
          </div>
        </>
      </BeforeAfterSlider>
      <p className="mt-2 text-sm leading-5 text-slate-600">The color follows a hand-placed sample wall shape. It is a visual preview, not a finished-paint rendering or room measurement.</p>
    </div>
  );
}

function WallTintPreview({
  imageUrl,
  imageAlt,
  mask,
  color,
  split,
  onSplit,
  demo = false,
}: {
  imageUrl: string;
  imageAlt: string;
  mask: MaskData | null;
  color: PaintColor;
  split: number;
  onSplit: (value: number) => void;
  demo?: boolean;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    setImageReady(false);
  }, [imageUrl]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!mask || !image || !canvas || !imageReady || !image.naturalWidth || !image.naturalHeight) return;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rgba = context.createImageData(width, height);
    const packed = decodeBase64Bytes(mask.dataBase64);
    const [red, green, blue] = color.hex.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16));
    const scaleX = mask.width / width;
    const scaleY = mask.height / height;
    for (let y = 0; y < height; y += 1) {
      const maskY = Math.min(mask.height - 1, Math.floor(y * scaleY));
      for (let x = 0; x < width; x += 1) {
        const maskX = Math.min(mask.width - 1, Math.floor(x * scaleX));
        const maskIndex = maskY * mask.width + maskX;
        const isWall = (packed[maskIndex >> 3] & (1 << (7 - (maskIndex & 7)))) !== 0;
        if (!isWall) continue;
        const imageIndex = (y * width + x) * 4;
        rgba.data[imageIndex] = red;
        rgba.data[imageIndex + 1] = green;
        rgba.data[imageIndex + 2] = blue;
        rgba.data[imageIndex + 3] = 142;
      }
    }
    context.putImageData(rgba, 0, 0);
  }, [color.hex, imageReady, mask, imageUrl]);

  return (
    <div>
      <BeforeAfterSlider
        split={split}
        onSplit={onSplit}
        min={0}
        max={100}
        enabled={Boolean(mask)}
        ariaLabel="Compare your original room photo with the selected wall color preview"
        ariaValueText={`${split}% original image, ${100 - split}% ${color.name} preview`}
        beforeLabel="Original"
        afterLabel="Color"
        stageClassName={`wq-comparison-stage relative mx-auto overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-900/10 ${imageReady ? "" : "aspect-video"}`}
        dividerClassName="shadow-[0_0_0_1px_rgba(15,23,42,0.25)]"
        handleClassName="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-slate-950/80 text-lg text-white"
        rangeClassName="mt-3 flex items-center gap-3 text-sm font-medium text-slate-700"
        rangeInputClassName="h-11 w-full accent-teal-700"
      >
        <>
          <img
            ref={imageRef}
            src={imageUrl}
            alt={imageAlt}
            draggable={false}
            onLoad={() => setImageReady(true)}
            onError={() => setImageReady(false)}
            className="pointer-events-none block h-auto w-full select-none"
          />
          {mask && imageReady && (
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ clipPath: `inset(0 0 0 ${split}%)` } as CSSProperties}
              aria-hidden="true"
            />
          )}
          <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between gap-3 text-xs font-bold uppercase tracking-[0.12em] text-white drop-shadow">
            <span className="rounded-full bg-slate-950/70 px-3 py-1.5">{mask ? "Original Room" : demo ? "Demo room" : "Original room photo"}</span>
            <span className="rounded-full bg-slate-950/70 px-3 py-1.5">{mask ? "Color Preview" : "Actual submitted image"}</span>
          </div>
        </>
      </BeforeAfterSlider>
      {!mask && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm leading-5 text-slate-700">
          <Info size={16} className="mt-0.5 shrink-0 text-slate-500" />
          The wall outline was unavailable, so this preview keeps your original image unchanged.
        </p>
      )}
    </div>
  );
}

export function EstimateEditor({ screen, motionProps, reduceMotion, state, handlers }: EstimateEditorProps) {
  const {
    mode,
    captureMode,
    sampleRoom,
    dimensions,
    measurementConfirmed,
    measurementFields,
    measurementError,
    activeRoomFrames,
    primaryFrameIndex,
    primaryImageUrl,
    primaryImageAlt,
    mask,
    trimMask,
    openingMask,
    transcript,
    observations,
    assessment,
    onAdjustCount,
    updateRoomSize,
    quoteActions,
    estimateSource,
    manualWallAreaOverride,
    wallAreaEditing,
    wallAreaDraft,
    wallAreaEditError,
    budgetAmount,
    budgetLabel,
    budgetIsCustom,
    budgetSliderValue,
    color,
    colorHexDraft,
    colorHexError,
    split,
    demoHeadingRef,
    items,
    scopeSelection,
    scopeMessage,
    includedItems,
    totals,
    budgetStatus,
    budgetCoverage,
    scopeFollowUpsOpen,
    doorScopeSelected,
    patchScopeSelected,
    frameWallMasks,
    openingChecks,
  } = state;
  const maskForFrame = (index: number) => (index === primaryFrameIndex ? mask : frameWallMasks?.[index] ?? null);
  // When the primary view has no wall mask, open the preview on the first view that has one.
  const [previewIndex, setPreviewFrame] = useState(() => {
    if (mask) return primaryFrameIndex;
    const fallback = frameWallMasks?.findIndex(Boolean) ?? -1;
    return fallback >= 0 ? fallback : primaryFrameIndex;
  });
  const showFramePicker = mode === "homeowner" && activeRoomFrames.length > 1 && activeRoomFrames.some((_, index) => index !== primaryFrameIndex && maskForFrame(index));
  const previewMask = maskForFrame(previewIndex) ?? mask;
  const previewImageUrl = maskForFrame(previewIndex) ? activeRoomFrames[previewIndex]?.previewUrl ?? primaryImageUrl : primaryImageUrl;
  const {
    onScreenChange,
    backFromEstimate,
    setDemoDimensions,
    startWallAreaEdit,
    saveWallAreaEdit,
    cancelWallAreaEdit,
    useCalculatedWallArea,
    onAreaReviewWallAreaDraftChange,
    onEstimateWallAreaDraftChange,
    continueFromAreaReview,
    chooseBudget,
    handleBudgetSlider,
    chooseWallColor,
    updateWallColorFromHex,
    fitBudget,
    toggleScope,
    toggleScopeFollowUps,
    updateDoorScopeSelection,
    updatePatchScopeSelection,
    updateMeasurement,
    setSplit,
    continueToContact,
    focusDemoHeading,
  } = handlers;

  if (screen === "measurements") {
    return (
      <motion.section key="measurements" className="space-y-6" {...motionProps}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button type="button" onClick={() => onScreenChange(mode === "demo" ? "demo-inspector" : "capture")} className="mb-4 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-slate-700 hover:text-slate-950"><ArrowLeft size={17} /> Back to {mode === "demo" ? "visual inspector" : "room tour"}</button>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">{mode === "demo" ? "03 · Room-size starting point" : "03 · Frame review and wall area"}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{mode === "demo" ? "Review the sample room." : "Review the room. Set a net wall area."}</h1>
            <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">{mode === "demo" ? "Use the sample values to see how the scope and budget change a preliminary price range." : "No reliable doorway scale was available. Review your actual submitted frames, then enter the approximate net wall area you want priced."}</p>
          </div>
          {mode === "demo" && <span className="inline-flex items-center gap-2 self-start rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950"><Sparkles size={15} /> SAMPLE QUANTITIES</span>}
        </div>

        {mode === "demo" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.75fr)]">
            <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 p-5 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-900">Generated demo · {sampleRoom?.name}</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Preset values for this example</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ["Room", sampleRoom?.dimensions ?? "Demo room"],
                  ["Walls", `${sampleRoom?.wallArea ?? 0} sq ft allowance`],
                  ["Ceiling", `${sampleRoom?.ceilingArea ?? 0} sq ft allowance`],
                  ["Trim", `${sampleRoom?.trimLength ?? 0} linear ft`],
                  ["Door sides", String(sampleRoom?.doorSides ?? 0)],
                  ["Visible marks", String(sampleRoom?.patchCount ?? 0)],
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-amber-200 bg-white p-3"><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span><strong className="mt-1 block text-base text-slate-900">{value}</strong></div>)}
              </div>
              <p className="mt-5 text-sm leading-6 text-amber-950">These values demonstrate the budget matcher only. They do not describe a homeowner's room or confirm a real job.</p>
              <button type="button" onClick={setDemoDimensions} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-base font-bold text-white hover:bg-slate-800">Use demo values <ArrowRight size={17} /></button>
            </div>
            <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
              <img src={sampleRoom?.image} alt={sampleRoom?.alt} className="aspect-video w-full object-cover" />
              <div className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Visible clue</p><p className="mt-2 text-base leading-7 text-slate-800">{sampleRoom?.visualClue}</p><p className="mt-3 text-sm leading-6 text-slate-600">{sampleRoom?.caution}</p></div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
            <CapturedFrameViewer
              captureMode={captureMode}
              primaryFrameIndex={primaryFrameIndex}
              primaryImageUrl={primaryImageUrl}
              primaryImageAlt={primaryImageAlt}
              activeRoomFrames={activeRoomFrames}
              wallMask={mask}
              trimMask={trimMask}
              openingMask={openingMask}
              transcript={transcript}
              observations={observations}
              onBackToCapture={() => onScreenChange("capture")}
            />

            <aside className="space-y-5">
              <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="net-wall-area-heading">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800"><Ruler size={21} /></span>
                  <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">Quantity for wall pricing</p><h2 id="net-wall-area-heading" className="mt-1 text-xl font-semibold text-slate-950">Approximate net wall area</h2></div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">Enter the wall surface you plan to paint, minus doors and windows when you can estimate those openings. Use a positive square-foot figure you can stand behind.</p>
                {wallAreaEditing ? (
                  <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4">
                    <label htmlFor="homeowner-net-wall-area" className="block text-base font-semibold text-slate-900">Net wall area (sq ft)</label>
                    <div className="mt-2 flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-3 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/20">
                      <input id="homeowner-net-wall-area" type="number" min="1" max="10000" step="1" inputMode="decimal" required value={wallAreaDraft} onChange={(event) => onAreaReviewWallAreaDraftChange(event.target.value)} aria-invalid={Boolean(wallAreaEditError)} aria-describedby="homeowner-net-wall-area-help" className="h-11 w-full bg-transparent text-base font-semibold tabular-nums text-slate-950 outline-none" placeholder="e.g. 420" />
                      <span className="shrink-0 text-sm font-semibold text-slate-600">sq ft</span>
                    </div>
                    <p id="homeowner-net-wall-area-help" className="mt-2 text-sm leading-5 text-slate-600">Enter 1–10,000 sq ft. Masks cannot calculate this value.</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button type="button" onClick={saveWallAreaEdit} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-900"><Check size={16} /> Save area</button>
                      <button type="button" onClick={cancelWallAreaEdit} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                    </div>
                    {wallAreaEditError && <p className="mt-3 flex items-start gap-2 text-sm leading-5 text-rose-800" role="alert"><CircleAlert size={16} className="mt-0.5 shrink-0" />{wallAreaEditError}</p>}
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Net wall area</span><strong className="mt-1 block text-2xl tabular-nums text-slate-950">{manualWallAreaOverride !== null ? `${formatDimensionValue(manualWallAreaOverride)} sq ft` : "Not entered"}</strong></div>
                    <button type="button" onClick={startWallAreaEdit} aria-label={manualWallAreaOverride !== null ? "Edit net wall area" : "Enter net wall area"} title={manualWallAreaOverride !== null ? "Edit net wall area" : "Enter net wall area"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:border-teal-700 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"><Pencil size={16} aria-hidden="true" />{manualWallAreaOverride !== null ? "Edit area" : "Enter area"}</button>
                  </div>
                )}
                <p className="mt-4 text-sm leading-6 text-slate-600">This area prices wall painting and any applicable primer. It does not establish room length, width, ceiling height, ceiling area, or trim length.</p>
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Ceiling and trim stay unpriced.</strong> No ceiling area, room perimeter, or trim quantity will be assumed from the wall figure.</div>
                {measurementError && <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-900" role="alert"><CircleAlert size={16} className="mt-0.5 shrink-0" />{measurementError}</p>}
                <button type="button" onClick={continueFromAreaReview} disabled={!primaryImageUrl || wallAreaEditing || manualWallAreaOverride === null} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-4 text-base font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">Continue to quote <ArrowRight size={17} /></button>
                <p className="mt-3 text-sm leading-5 text-slate-600">Save a positive area above to continue. Your estimate will use the supplied wall price range.</p>
              </section>
              <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-950"><DoorOpen size={19} className="text-teal-800" /> Visible features</h3>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">Doors seen</dt><dd className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums text-slate-950"><button type="button" aria-label="Fewer doors" onClick={() => onAdjustCount?.("visibleDoorCount", -1)} className="h-9 w-9 rounded-lg border border-slate-300 bg-white">−</button><span className="min-w-6 text-center">{assessment.visibleDoorCount ?? 0}</span><button type="button" aria-label="More doors" onClick={() => onAdjustCount?.("visibleDoorCount", 1)} className="h-9 w-9 rounded-lg border border-slate-300 bg-white">+</button></dd></div>
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">Windows seen</dt><dd className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums text-slate-950"><button type="button" aria-label="Fewer windows" onClick={() => onAdjustCount?.("visibleWindowCount", -1)} className="h-9 w-9 rounded-lg border border-slate-300 bg-white">−</button><span className="min-w-6 text-center">{assessment.visibleWindowCount ?? 0}</span><button type="button" aria-label="More windows" onClick={() => onAdjustCount?.("visibleWindowCount", 1)} className="h-9 w-9 rounded-lg border border-slate-300 bg-white">+</button></dd></div>
                  <div className="col-span-2 rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">Surface marks to inspect</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{assessment.visibleMarkCount ?? "Not clear"}</dd></div>
                </dl>
                <p className="mt-4 text-sm leading-6 text-slate-600">Tap − or + to fix a count; the door and window deduction updates automatically. These are visual observations only. WalkQuote does not diagnose stains, moisture, lead, mold, or structural problems.</p>
              </div>
            </aside>
          </div>
        )}
      </motion.section>
    );
  }

  if (!dimensions || !measurementConfirmed) return null;
  const statusText = budgetStatus === "within" ? "Within budget" : budgetStatus === "close" ? "Close match" : budgetStatus === "over" ? "Over budget" : "Market range";
  const statusCopy = budgetStatus === "within"
    ? "The upper end of this range sits inside your target."
    : budgetStatus === "close"
      ? "Your target reaches the low end. The upper end is higher."
      : budgetStatus === "over"
        ? "This scope starts above your target. Compare optional work or adjust the budget."
        : "No budget target is set. Review the selected scope and price range.";
  const measurementsLabel = mode === "demo"
    ? sampleRoom?.dimensions ?? "Illustrative sample dimensions"
    : roomDimensionsLabel(dimensions);
  const confidenceLabel = measurementSourceLabel(mode === "demo" ? "sample_preset" : estimateSource, mode);
  const areaOnlyEstimate = mode === "homeowner" && estimateSource === "homeowner_entered_net_wall_area";
  const quantitySourceNote = mode === "demo"
    ? "Illustrative demo quantities from a generated sample room. They do not describe a homeowner's room or a measured job."
    : estimateSource === "doorway_scale"
      ? "Estimated from a visible, apparently standard interior doorway using a typical 80-inch (6 ft 8 in) height. This is a rough visual scale, not a physical survey."
      : "Uses the net wall area you entered as an approximate quantity for wall painting and any applicable primer. It does not establish physical room dimensions. No ceiling area, perimeter, or trim quantity is inferred.";

  return (
    <motion.section key="estimate" className="space-y-7" onAnimationComplete={focusDemoHeading} {...motionProps}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={backFromEstimate} className="mb-4 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-slate-700 hover:text-slate-950"><ArrowLeft size={17} /> Back to {mode === "demo" ? "visual inspector" : estimateSource === "doorway_scale" ? "room tour" : "frame review"}</button>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">{mode === "demo" ? "03 · Budget vs. Quote" : "04 · Budget and scope"}</p>
          <h1 ref={mode === "demo" ? demoHeadingRef : undefined} tabIndex={mode === "demo" ? -1 : undefined} className="mt-2 rounded text-3xl font-semibold tracking-tight text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 sm:text-4xl">{mode === "demo" ? "Budget vs. Quote" : "Shape the estimate around the work."}</h1>
          {mode === "demo" && <p className="mt-2 max-w-2xl text-base leading-6 text-slate-600">Toggle ceiling, trim, and drywall repair to see the sample total and budget match update together.</p>}
        </div>
        {mode === "demo" ? <span className="inline-flex max-w-full items-center gap-2 self-start rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950"><Sparkles size={15} /> Illustrative sample · not measured from your room</span> : <span className="inline-flex items-center gap-2 self-start rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-950"><BadgeCheck size={16} /> Approximate Estimate</span>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.92fr)]">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl" aria-labelledby="range-heading">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">Preliminary price range</span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-300">WQ · 01</span>
          </div>
          <div className="px-5 py-7 sm:px-7 sm:py-9">
            <p className="text-sm font-semibold text-slate-300">Selected scope · including {PRICE_BOOK.taxAndConsumables.label} tax and consumables assumption</p>
            <h2 id="range-heading" aria-live="polite" aria-atomic="true" className="mt-3 flex flex-wrap items-baseline gap-x-3 text-4xl font-semibold tracking-tight tabular-nums sm:text-6xl"><span>{money(totals.low)}</span><span className="text-3xl text-teal-300 sm:text-4xl">–</span><span>{money(totals.high)}</span></h2>
            <div className={`mt-7 rounded-2xl border p-4 sm:p-5 ${budgetStatus === "within" ? "border-emerald-300/30 bg-emerald-500/10" : budgetStatus === "close" ? "border-amber-300/30 bg-amber-400/10" : budgetStatus === "over" ? "border-rose-300/30 bg-rose-500/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-lg font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${budgetStatus === "within" ? "bg-emerald-400" : budgetStatus === "close" ? "bg-amber-300" : budgetStatus === "over" ? "bg-rose-400" : "bg-slate-400"}`} /><span aria-live="polite" aria-atomic="true">{statusText}</span></span><span className="text-sm font-semibold tabular-nums text-slate-200">{budgetAmount === null ? "No target" : `Target ${money(budgetAmount)}`}</span></div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{statusCopy}</p>
              {quoteActions && <div className="mt-4 border-t border-white/10 pt-4">{quoteActions}</div>}
              {mode === "demo" && <div className="mt-5 border-t border-white/10 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><label htmlFor="demo-budget-slider" className="text-sm font-semibold text-slate-100">Adjust the sample budget target</label><strong className="text-base tabular-nums text-teal-200">{budgetAmount === null ? "No target" : money(budgetAmount)}</strong></div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Choose a sample budget target">
                  {BUDGET_CHOICES.map((choice) => {
                    const active = choice.value === null ? budgetAmount === null : budgetAmount === choice.value && !budgetIsCustom;
                    return <button key={choice.label} type="button" aria-pressed={active} onClick={() => chooseBudget(choice.value, choice.label)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${active ? "border-teal-300 bg-teal-300 text-slate-950" : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"}`}>{choice.label}</button>;
                  })}
                </div>
                <input id="demo-budget-slider" type="range" min="500" max="5000" step="250" value={budgetSliderValue} onChange={(event) => handleBudgetSlider(event.target.value)} aria-valuetext={budgetAmount === null ? `No target selected; slider at ${money(budgetSliderValue)}` : money(budgetSliderValue)} aria-describedby="demo-budget-help" className="mt-2 min-h-11 w-full cursor-pointer accent-teal-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" />
                <div className="flex justify-between text-xs font-medium tabular-nums text-slate-400"><span>$500</span><span>$5,000</span></div>
                <p id="demo-budget-help" className="mt-2 text-sm leading-5 text-slate-300">A target change updates the match. Scope choices and quantity edits update the preliminary range.</p>
              </div>}
              {budgetAmount !== null && <div className="mt-4"><div className="relative h-2.5 rounded-full bg-white/15" role="meter" aria-label="Budget coverage of the upper range" aria-valuemin={0} aria-valuemax={100} aria-valuenow={budgetCoverage}><motion.div className="h-full rounded-full bg-teal-300" initial={{ width: reduceMotion ? `${budgetCoverage}%` : "0%" }} animate={{ width: `${budgetCoverage}%` }} transition={{ duration: reduceMotion ? 0 : 0.65, ease: "easeOut" }} /><span className="absolute -top-1 h-4 w-0.5 bg-white" style={{ left: `${budgetCoverage}%` }} /></div><div className="mt-2 flex justify-between text-xs text-slate-400"><span>{budgetCoverage}% of upper range covered</span><span>{money(totals.high)}</span></div></div>}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-white/5 p-4"><span className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{mode === "demo" ? "Room-size basis" : "Quantity basis"}</span><strong className="mt-2 block text-base leading-6 tabular-nums text-white">{measurementsLabel}</strong></div>
              <div className="rounded-xl bg-white/5 p-4"><span className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Estimate source</span><strong className="mt-2 block text-sm leading-5 text-white">{confidenceLabel}</strong></div>
            </div>
            {mode === "homeowner" && estimateSource === "doorway_scale" && <RoomSizeAdjuster fields={measurementFields} assessment={assessment} onFieldChange={updateRoomSize ?? updateMeasurement} onAdjustCount={onAdjustCount} openingChecks={openingChecks} />}
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white/5 p-4"><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Gross wall area</span><strong className="mt-1 block text-base tabular-nums text-white">{typeof dimensions.grossWallArea === "number" ? `${formatDimensionValue(dimensions.grossWallArea)} sq ft` : "Not calculated"}</strong><span className="mt-1 block text-xs leading-5 text-slate-400">{typeof dimensions.grossWallArea === "number" ? "Before opening deduction" : "No gross area from the entered net figure"}</span></div>
              <div className="rounded-xl bg-white/5 p-4"><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Opening deduction</span><strong className="mt-1 block text-base tabular-nums text-white">{typeof dimensions.grossWallArea !== "number" ? "Not calculated" : dimensions.openingDeductionSqFt !== null ? `−${formatDimensionValue(dimensions.openingDeductionSqFt)} sq ft` : "Not deducted"}</strong><span className="mt-1 block text-xs leading-5 text-slate-400">Only applied when supported by the views</span></div>
              <div className="rounded-xl bg-white/5 p-4">
                <div className="flex items-center justify-between gap-2"><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Paintable wall area · net</span></div>
                {!wallAreaEditing ? <>
                  <div className="mt-1 flex flex-wrap items-center gap-2"><strong className="text-lg tabular-nums text-white">{formatDimensionValue(dimensions.wallArea)} sq ft{areaOnlyEstimate ? " · homeowner-entered" : manualWallAreaOverride !== null ? " · edited" : ""}</strong><button type="button" onClick={startWallAreaEdit} aria-label="Edit paintable wall area" title="Edit paintable wall area" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-white/20 text-teal-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"><Pencil size={15} aria-hidden="true" /><span className="sr-only">Edit wall area</span></button></div>
                  {manualWallAreaOverride !== null && !areaOnlyEstimate && <button type="button" onClick={useCalculatedWallArea} className="mt-2 min-h-10 rounded-lg px-2 text-left text-xs font-semibold text-teal-200 underline decoration-teal-200/60 underline-offset-2 hover:text-white">Use calculated area</button>}
                </> : <div className="mt-3">
                  <label htmlFor="paintable-wall-area" className="sr-only">Paintable wall area in square feet</label>
                  <input id="paintable-wall-area" type="number" min="1" max="10000" step="1" inputMode="decimal" value={wallAreaDraft} onChange={(event) => onEstimateWallAreaDraftChange(event.target.value)} className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold tabular-nums text-slate-950 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-300" />
                  <p className="mt-2 text-xs leading-5 text-slate-300">The price range updates as you enter a valid area.</p>
                  <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={saveWallAreaEdit} className="min-h-10 rounded-lg bg-teal-300 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-teal-200">Apply area</button><button type="button" onClick={cancelWallAreaEdit} className="min-h-10 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">Cancel</button></div>
                  {wallAreaEditError && <p className="mt-2 text-xs leading-5 text-rose-200" role="alert">{wallAreaEditError}</p>}
                </div>}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-white/5 p-4"><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Ceiling area</span><strong className="mt-1 block text-base tabular-nums text-white">{typeof dimensions.ceilingArea === "number" ? `${formatDimensionValue(dimensions.ceilingArea)} sq ft` : "Not priced"}</strong>{typeof dimensions.ceilingArea !== "number" && <span className="mt-1 block text-xs leading-5 text-slate-400">No supported ceiling quantity</span>}</div>
              <div className="rounded-xl bg-white/5 p-4"><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Perimeter / trim allowance</span><strong className="mt-1 block text-base tabular-nums text-white">{typeof dimensions.trimLength === "number" ? `${formatDimensionValue(dimensions.trimLength)} ft` : "Not priced"}</strong>{typeof dimensions.trimLength !== "number" && <span className="mt-1 block text-xs leading-5 text-slate-400">No supported perimeter or trim quantity</span>}</div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{quantitySourceNote}</p>
            {manualWallAreaOverride !== null && !areaOnlyEstimate && <p className="mt-2 text-sm leading-5 text-teal-100">Your edited paintable wall area replaces the calculated net area for wall and primer pricing. Gross area and any supported opening deduction remain shown for contractor review.</p>}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="preview-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">05 · Wall color preview</p><h2 id="preview-heading" className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{mode === "demo" ? "Try a color on the sample room." : "Try a color on this room image."}</h2></div>
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-600">{mode === "demo" ? "Illustrative wall mask" : previewMask ? "Wall outline ready" : "Original image"}</span>
          </div>
          {primaryImageUrl ? <div className="mt-4">{mode === "demo" ? <SampleWallTintPreview room={sampleRoom ?? ROOMS.living} color={color} split={split} onSplit={setSplit} /> : <WallTintPreview imageUrl={previewImageUrl} imageAlt={primaryImageAlt} mask={previewMask} color={color} split={split} onSplit={setSplit} />}</div> : <div className="mt-4 grid aspect-video place-items-center rounded-2xl bg-slate-100 text-slate-600"><Info size={22} /><span className="mt-2 text-sm">Room photo unavailable</span></div>}
          {showFramePicker && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Choose which room view to preview" data-testid="preview-frame-picker">
              {activeRoomFrames.map((frame, index) => (
                <button key={frame.id} type="button" data-testid={`preview-frame-${index}`} aria-pressed={index === previewIndex} disabled={!maskForFrame(index)} onClick={() => setPreviewFrame(index)} className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${index === previewIndex ? "border-teal-700" : "border-transparent hover:border-slate-300"}`}>
                  <img src={frame.previewUrl} alt={`View ${index + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute bottom-0.5 left-1 rounded bg-slate-950/70 px-1 text-[10px] font-bold text-white">{index + 1}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label={mode === "demo" ? "Choose a sample wall color" : "Choose a paint color"}>
            {(mode === "demo" ? DEMO_COLORS : COLORS).map((choice) => {
              const active = color.name === choice.name && color.hex.toUpperCase() === choice.hex.toUpperCase();
              return <button key={choice.name} type="button" aria-pressed={active} onClick={() => chooseWallColor({ name: choice.name, hex: choice.hex })} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition ${active ? "border-teal-800 bg-teal-50 text-slate-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}><span className="h-7 w-7 shrink-0 rounded-full border border-slate-900/10" style={{ backgroundColor: choice.hex }} /><span className="min-w-0 flex-1 text-left">{choice.name}</span>{active && <Check size={15} className="text-teal-800" />}</button>;
            })}
          </div>
          {mode === "homeowner" && <>
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-800"><input type="color" value={color.hex} onChange={(event) => chooseWallColor(colorFromHex(event.target.value))} className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0" /> Choose another shade</label>
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">HEX<input type="text" maxLength={7} value={colorHexDraft} onChange={(event) => updateWallColorFromHex(event.target.value)} aria-invalid={Boolean(colorHexError)} aria-label="Custom wall color HEX value" className="w-24 bg-transparent text-sm font-semibold uppercase text-slate-900 outline-none" /></label>
            </div>
            {colorHexError && <p className="mt-2 text-sm text-rose-800" role="alert">{colorHexError}</p>}
          </>}
          <p className="mt-3 text-sm leading-5 text-slate-600">{mode === "demo" ? "The sample tint follows an illustrative wall mask and leaves the door, window, and trim clear. It is not a finished-paint rendering." : "Color preview uses a pixel mask on your submitted image. It is a visual guide, not a finished-paint rendering or a measurement."}</p>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="scope-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">Itemized scope</p><h2 id="scope-heading" className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Keep the work that matters.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Walls stay in the estimate. Turn optional work on or off to see the range change.</p></div>
            <button type="button" onClick={fitBudget} disabled={budgetAmount === null} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-teal-800 px-4 py-2.5 text-sm font-bold text-teal-900 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">Fit my budget <ArrowRight size={15} /></button>
          </div>
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">Rates follow the supplied price book. Line items are shown before the {PRICE_BOOK.taxAndConsumables.label} tax and consumables assumption.</p>
          {areaOnlyEstimate && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Ceiling and trim are unpriced.</strong> No supported ceiling area or room perimeter is available, so those optional items are excluded from this range. The entered net wall area supports wall painting and any applicable primer only.</p>}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <button type="button" aria-expanded={scopeFollowUpsOpen} onClick={toggleScopeFollowUps} className="flex min-h-12 w-full items-center gap-3 text-left text-slate-900 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-teal-800"><DoorOpen size={19} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-base">Add doors or patch work</strong><span className="mt-0.5 block text-sm font-normal text-slate-600">Optional, chosen by you. Nothing is added from a visual observation alone.</span></span>
              <ChevronDown size={19} className={`shrink-0 transition-transform ${scopeFollowUpsOpen ? "rotate-180" : ""}`} />
            </button>
            {scopeFollowUpsOpen && <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="flex cursor-pointer items-start gap-3 text-base font-semibold text-slate-900"><input type="checkbox" checked={doorScopeSelected} onChange={(event) => updateDoorScopeSelection(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-teal-800" /><span>Include doors or frames to paint</span></label>
                {doorScopeSelected && <label className="mt-4 block text-sm font-semibold text-slate-800">Paintable sides to include<input type="number" min="1" max="20" step="1" inputMode="numeric" value={measurementFields.doorSides} onChange={(event) => updateMeasurement("doorSides", event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base tabular-nums text-slate-950 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20" /></label>}
                <p className="mt-3 text-sm leading-5 text-slate-600">{assessment.visibleDoorCount !== null && assessment.visibleDoorCount > 0 ? `The image review noted about ${assessment.visibleDoorCount} visible door${assessment.visibleDoorCount === 1 ? "" : "s"}. Choose only sides you want painted.` : hasDoorScopeCue(transcript) ? "Your room note mentions doors or frames. Choose only sides you want painted." : "A visible door is not automatically included in the estimate."}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="flex cursor-pointer items-start gap-3 text-base font-semibold text-slate-900"><input type="checkbox" checked={patchScopeSelected} onChange={(event) => updatePatchScopeSelection(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-teal-800" /><span>Include minor patch work</span></label>
                {patchScopeSelected && <label className="mt-4 block text-sm font-semibold text-slate-800">Spots to include<input type="number" min="1" max="12" step="1" inputMode="numeric" value={measurementFields.patchCount} onChange={(event) => updateMeasurement("patchCount", event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base tabular-nums text-slate-950 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20" /></label>}
                <p className="mt-3 text-sm leading-5 text-slate-600">{assessment.visibleMarkCount !== null && assessment.visibleMarkCount > 0 ? `The image review noted about ${assessment.visibleMarkCount} visible mark${assessment.visibleMarkCount === 1 ? "" : "s"}. Marks are not a damage diagnosis.` : hasPatchScopeCue(transcript) ? "Your room note mentions surface work. Choose only spots you want inspected." : "Choose only spots you want inspected. Visible marks are not diagnoses."}</p>
              </div>
            </div>}
          </div>
          <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
            {items.map((item) => {
              const included = itemIsIncluded(item, scopeSelection);
              return <div key={item.id} className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between ${included ? "" : "opacity-65"}`}>
                <div className="flex min-w-0 items-start gap-3">
                  {item.required ? <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"><Check size={14} /></span> : <button type="button" aria-pressed={included} aria-label={`${included ? "Remove" : "Include"} ${item.label}`} onClick={() => toggleScope(item)} className={`grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${included ? "border-teal-800 bg-teal-800 text-white" : "border-slate-400 bg-white text-transparent hover:border-teal-700"}`}>{included && <Check size={14} aria-hidden="true" />}</button>}
                  <div><strong className="text-base text-slate-950">{item.label}</strong><p className="mt-1 text-sm leading-5 text-slate-600">{item.detail}</p></div>
                </div>
                <div className="pl-9 text-left sm:pl-0 sm:text-right"><strong className="block text-base font-semibold tabular-nums text-slate-950">{included ? moneyRange(item.low, item.high) : "Not included"}</strong><small className="mt-1 block text-sm text-slate-500">{item.required ? "Required baseline" : included ? `Remove to save up to ${money(item.high * (1 + PRICE_BOOK.taxAndConsumables.rate))}` : `Add ${moneyRange(item.low, item.high)}`}</small></div>
              </div>;
            })}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600"><span>Tax + consumables assumption · {PRICE_BOOK.taxAndConsumables.label}</span><strong className="tabular-nums text-slate-900">{moneyRange(totals.taxLow, totals.taxHigh)}</strong></div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-950 px-4 py-4 text-white"><span className="font-semibold">Current preliminary total</span><strong className="text-lg tabular-nums">{moneyRange(totals.low, totals.high)}</strong></div>
          {scopeMessage && <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-900" role="status"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{scopeMessage}</p>}
          {budgetAmount === null && <p className="mt-3 text-sm text-slate-600">Choose a working budget on the first step to use the scope suggestion.</p>}
        </section>

        <aside className="space-y-5">
          <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <p className="flex items-center gap-2 text-base font-bold text-amber-950"><CircleAlert size={18} /> Preliminary estimate</p>
            <p className="mt-2 text-sm leading-6 text-amber-950">{mode === "demo" ? "Demo values show how the selected scope and budget change a sample price range. They do not describe a homeowner's room or a measured job." : areaOnlyEstimate ? "This preliminary range prices wall painting from your approximate net wall area, plus any selected door or patch work and an applicable primer allowance. The entered figure does not establish room dimensions. Ceiling painting and trim are excluded because supported quantities are unavailable. A contractor verifies scope, preparation, and local pricing before a final quote." : "This preliminary range uses an approximate scale estimate from a visible, apparently standard interior doorway. Any supported opening deduction appears in the quantity summary; when it says “Not deducted,” no opening area was subtracted. A contractor verifies room size, preparation, and local pricing before a final quote."}</p>
            <p className="mt-3 border-t border-amber-200 pt-3 text-sm leading-6 text-amber-950">Final pricing is subject to an on-site moisture and lead check. The {PRICE_BOOK.taxAndConsumables.label} figure is a planning assumption, not a tax calculation.</p>
          </div>
          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-800"><Sparkles size={19} /></span><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Visible observations</p><h3 className="text-lg font-semibold text-slate-950">What the frames show</h3></div></div>
            {observations.length ? <ul className="mt-4 space-y-2">{observations.map((observation, index) => <li key={`${observation}-${index}`} className="flex gap-2 text-sm leading-6 text-slate-700"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-700" />{observation}</li>)}</ul> : <p className="mt-4 text-sm leading-6 text-slate-600">No confident visual observations returned. The contractor can review the submitted media.</p>}
            {transcript && <div className="mt-4 rounded-xl bg-slate-50 p-4"><span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Room note</span><p className="mt-2 text-sm leading-6 text-slate-800">“{transcript}”</p></div>}
            <p className="mt-4 text-sm leading-5 text-slate-500">Visual marks are not damage, moisture, lead, or mold diagnoses.</p>
          </div>
          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-800"><ClipboardList size={19} /></span><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Price source</p><h3 className="text-lg font-semibold text-slate-950">Supplied painting price book</h3></div></div>
            <dl className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between gap-3"><dt>Walls · two coats</dt><dd className="font-semibold tabular-nums">{PRICE_BOOK.walls.summaryRateLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt>Ceiling</dt><dd className="font-semibold tabular-nums">{PRICE_BOOK.ceiling.summaryRateLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt>Trim</dt><dd className="font-semibold tabular-nums">{PRICE_BOOK.trim.summaryRateLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt>Door side</dt><dd className="font-semibold tabular-nums">{PRICE_BOOK.doors.summaryRateLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt>Minor patch</dt><dd className="font-semibold tabular-nums">{PRICE_BOOK.patch.summaryRateLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt>Dark-to-light primer</dt><dd className="font-semibold tabular-nums">{PRICE_BOOK.primer.summaryRateLabel}</dd></div>
            </dl>
          </div>
        </aside>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="flex items-start gap-2 text-sm leading-6 text-slate-700"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-teal-800" />{mode === "demo" ? "Sample values stay in this walkthrough. No contact or room request is created." : "Your name and phone are requested only when you choose to send the estimate."}</p>
        {mode === "demo" ? (
          <button type="button" onClick={() => onScreenChange("demo-inspector")} className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-4 text-base font-bold text-slate-800 transition hover:bg-slate-50"><ArrowLeft size={17} /> Back to visual inspector</button>
        ) : (
          <button type="button" onClick={continueToContact} className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-800 px-6 py-4 text-base font-bold text-white transition hover:bg-teal-900">Send estimate to local painter <ArrowRight size={17} /></button>
        )}
      </div>
    </motion.section>
  );
}

export function EstimateMobileSummary({
  mode,
  screen,
  dimensions,
  measurementConfirmed,
  totals,
  budgetStatus,
  onContinueToContact,
}: {
  mode: "homeowner" | "demo";
  screen: Screen;
  dimensions: RoomDimensions | null;
  measurementConfirmed: boolean;
  totals: QuoteTotals;
  budgetStatus: ReturnType<typeof statusForBudget>;
  onContinueToContact: () => void;
}) {
  if (mode !== "homeowner" || screen !== "estimate" || !dimensions || !measurementConfirmed) return null;
  return (
    <aside className="wq-mobile-estimate-bar" aria-label="Current estimate and budget match">
      <div className="wq-mobile-estimate-meta" aria-live="polite" aria-atomic="true">
        <div className="wq-mobile-estimate-price">
          <span>Current estimate</span>
          <strong>{moneyRange(totals.low, totals.high)}</strong>
        </div>
        <span className={`wq-mobile-estimate-match wq-budget-${budgetStatus}`}>{budgetStatusLabel(budgetStatus)}</span>
      </div>
      <button type="button" onClick={onContinueToContact} className="wq-mobile-estimate-action">Continue to Send <ArrowRight size={17} aria-hidden="true" /></button>
    </aside>
  );
}
