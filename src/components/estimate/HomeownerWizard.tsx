import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Camera, ShieldCheck, Sparkles, Video } from "lucide-react";
import { isValidPhoneNumber } from "react-phone-number-input";
import { contacts } from "@/integrations/core";
import { RoomEstimate } from "@/entities";
import type { RoomEstimateMediaManifest, RoomEstimateRecord } from "@/entities";
import { analyzeRoom } from "@/functions";
import type { AnalyzeRoomRequest, AnalysisSourceId } from "@/functions";
import {
  audioBlobToWavBase64,
  beginAudioNoteCapture,
  beginVideoWalkthrough,
  blobToBase64,
  blobToDataUrl,
  compressRoomPhoto,
  extractRepresentativeFrames,
  MAX_ANALYSIS_FRAME_BYTES,
  MAX_AUDIO_NOTE_BYTES,
  MAX_CAPTURED_VIDEO_SECONDS,
  MAX_COMPRESSED_PHOTO_BYTES,
  MAX_ROOM_PHOTOS,
  MAX_VIDEO_CAPTURE_BYTES,
  MIN_ROOM_PHOTOS,
  revokeMediaUrl,
} from "@/lib/room-media";
import type { RecordingSession, RoomImageAsset, WalkthroughRecording } from "@/lib/room-media";
import { PrivateRoomMediaError, PrivateRoomMediaUploadSession } from "@/lib/private-room-media";
import type { PrivateRoomMediaAssetInput } from "@/lib/private-room-media";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnalysisProgress } from "@/components/estimate/AnalysisProgress";
import { BudgetSetup } from "@/components/estimate/BudgetSetup";
import { ContactSubmission, type ContactSubmissionHandlers, type ContactSubmissionState } from "@/components/estimate/ContactSubmission";
import { EstimateEditor, EstimateMobileSummary, type EstimateEditorHandlers, type EstimateEditorState } from "@/components/estimate/EstimateEditor";
import { HeroHeader, JourneyProgress, PageFooter } from "@/components/estimate/JourneyNav";
import { RoomCapture } from "@/components/estimate/RoomCapture";
import { SampleDemoInspector } from "@/components/estimate/SampleDemoInspector";
import {
  bestBudgetFit,
  buildScopeLines,
  calculateTotals,
  itemIsIncluded,
  money,
  moneyRange,
  PRICE_BOOK,
  statusForBudget,
} from "@/lib/pricing";
import {
  AnalysisStageError,
  BUDGET_CHOICES,
  BRAND_MARK,
  cleanRoomNote,
  clampArea,
  clampCount,
  colorFromHex,
  COLORS,
  decodeOptionalMask,
  DEMO_COLORS,
  DEMO_SCOPE_SELECTIONS,
  DEMO_SPATIAL_MATH,
  DEMO_TRANSCRIPT,
  DEMO_VIDEO,
  demoMeasurementFields,
  formatDimensionValue,
  formatLimitResetTime,
  hasDoorScopeCue,
  hasOptionalScopeCue,
  hasPatchScopeCue,
  ROOMS,
  VIDEO_CARD_IMAGE,
} from "@/lib/walkquote-estimate";
import type {
  AnalysisReply,
  AnalysisStatus,
  CapturedAudioAsset,
  CapturedVideoAsset,
  CaptureMode,
  EstimateSource,
  MaskData,
  PaintColor,
  RoomAssessment,
  RoomDimensions,
  RoomFrame,
  RoomId,
  RoomShape,
  Screen,
  ScopeLine,
  ScopeSelections,
} from "@/types/estimate";

function pageMotion(reduceMotion: boolean) {
  return {
    initial: reduceMotion ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: reduceMotion ? undefined : { opacity: 0, y: -10 },
    transition: { duration: reduceMotion ? 0 : 0.28, ease: "easeOut" as const },
  };
}

function ExperienceModeSwitch({
  mode,
  onSelect,
  disabled,
}: {
  mode: "homeowner" | "demo";
  onSelect: (nextMode: "homeowner" | "demo") => void;
  disabled: boolean;
}) {
  return (
    <section className="mb-6 rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Choose estimate mode">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Choose your experience</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">Open the prepared sample, or capture your own room. Sample activity stays separate from real room requests.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-amber-900"><ShieldCheck size={14} /> Sample data is never saved</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2" role="group" aria-label="Choose the interactive demo or live AI capture">
        <button
          type="button"
          aria-label="Explore Interactive Demo"
          aria-pressed={mode === "demo"}
          disabled={disabled}
          onClick={() => onSelect("demo")}
          className={`group flex min-h-[84px] w-full items-center gap-3 rounded-2xl border border-slate-950 bg-slate-950 px-4 py-3 text-left text-white shadow-md transition duration-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-60 ${mode === "demo" ? "ring-2 ring-amber-300/50" : ""}`}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-300 text-slate-950 transition group-hover:bg-amber-200"><Sparkles size={20} /></span>
          <span className="min-w-0 flex-1"><strong className="block text-base font-bold text-white">Explore Interactive Demo</strong><span className="mt-0.5 block text-sm leading-5 text-slate-300">Prepared room with illustrative masks, scale math, color preview and budget matching.</span></span>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${mode === "demo" ? "bg-amber-300 text-slate-950" : "bg-white/10 text-amber-200"}`}>{mode === "demo" ? "ACTIVE" : "DEMO"}</span>
        </button>
        <button
          type="button"
          aria-label="Capture My Own Room (Live AI)"
          aria-pressed={mode === "homeowner"}
          disabled={disabled}
          onClick={() => onSelect("homeowner")}
          className={`group flex min-h-[84px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 ${mode === "homeowner" ? "border-teal-700 bg-teal-50 ring-2 ring-teal-700/15" : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"}`}
        >
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition ${mode === "homeowner" ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"}`}><Camera size={20} /></span>
          <span className="min-w-0 flex-1"><strong className="block text-base font-bold text-slate-950">Capture My Own Room (Live AI)</strong><span className="mt-0.5 block text-sm leading-5 text-slate-600">Video or photos from your room. Live AI analysis is restricted to the project administrator account.</span></span>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${mode === "homeowner" ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-500"}`}>{mode === "homeowner" ? "ACTIVE" : "LIVE"}</span>
        </button>
      </div>
      {disabled && <p className="mt-3 text-sm text-amber-900" role="status">Finish the current recording or analysis before changing modes.</p>}
    </section>
  );
}


export function HomeownerWizard() {
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const [screen, setScreen] = useState<Screen>("setup");
  const [mode, setMode] = useState<"homeowner" | "demo">("homeowner");
  const [sampleRoomId, setSampleRoomId] = useState<RoomId>("living");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("video");
  const [budgetAmount, setBudgetAmount] = useState<number | null>(1500);
  const [budgetLabel, setBudgetLabel] = useState("$1,500");
  const [budgetIsCustom, setBudgetIsCustom] = useState(false);
  const [budgetSliderValue, setBudgetSliderValue] = useState(1500);
  const [color, setColor] = useState<PaintColor>(() => colorFromHex(COLORS[0].hex));
  const [colorHexDraft, setColorHexDraft] = useState(COLORS[0].hex.toUpperCase());
  const [split, setSplit] = useState(52);
  const [demoMasksVisible, setDemoMasksVisible] = useState(true);
  const [scopeSelection, setScopeSelection] = useState<ScopeSelections>({});
  const [scopeMessage, setScopeMessage] = useState("");
  const [setupError, setSetupError] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [audioError, setAudioError] = useState("");
  const [analysisConsent, setAnalysisConsent] = useState(false);
  const [mediaShareConsent, setMediaShareConsent] = useState(false);
  const [scopeNote, setScopeNote] = useState("");
  const [videoAsset, setVideoAsset] = useState<CapturedVideoAsset | null>(null);
  const [preparingVideo, setPreparingVideo] = useState(false);
  const [audioNote, setAudioNote] = useState<CapturedAudioAsset | null>(null);
  const [photoAssets, setPhotoAssets] = useState<RoomImageAsset[]>([]);
  const [videoFrames, setVideoFrames] = useState<RoomFrame[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioRecording, setAudioRecording] = useState(false);
  const [audioRecordingSeconds, setAudioRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [observations, setObservations] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<RoomAssessment>({
    visibleDoorCount: null,
    visibleWindowCount: null,
    visibleMarkCount: null,
    wallTone: "unknown",
    scaleReference: "none",
    suggestedDimensions: null,
    openingDeductionSqFt: null,
  });
  const [mask, setMask] = useState<MaskData | null>(null);
  const [trimMask, setTrimMask] = useState<MaskData | null>(null);
  const [openingMask, setOpeningMask] = useState<MaskData | null>(null);
  const [maskUnavailable, setMaskUnavailable] = useState(false);
  const [analysisStatuses, setAnalysisStatuses] = useState<AnalysisStatus[]>(["pending", "pending", "pending", "pending"]);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisErrorCode, setAnalysisErrorCode] = useState<string | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState(0);
  const [roomShape, setRoomShape] = useState<RoomShape>("rectangular");
  const [estimateSource, setEstimateSource] = useState<EstimateSource>("homeowner_entered_net_wall_area");
  const [manualWallAreaOverride, setManualWallAreaOverride] = useState<number | null>(null);
  const [wallAreaEditing, setWallAreaEditing] = useState(false);
  const [wallAreaDraft, setWallAreaDraft] = useState("");
  const [wallAreaEditError, setWallAreaEditError] = useState("");
  const [doorScopeSelected, setDoorScopeSelected] = useState(false);
  const [patchScopeSelected, setPatchScopeSelected] = useState(false);
  const [scopeFollowUpsOpen, setScopeFollowUpsOpen] = useState(false);
  const [measurementFields, setMeasurementFields] = useState({
    lengthFt: "",
    widthFt: "",
    perimeterFt: "",
    ceilingAreaSqFt: "",
    ceilingHeightFt: "",
    doorSides: "",
    patchCount: "",
  });
  const [measurementConfirmed, setMeasurementConfirmed] = useState(false);
  const [measurementError, setMeasurementError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [colorHexError, setColorHexError] = useState("");
  const [demoVideoOpen, setDemoVideoOpen] = useState(false);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const captureSessionRef = useRef<RecordingSession<WalkthroughRecording> | null>(null);
  const audioSessionRef = useRef<RecordingSession<Blob> | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStopTimeoutRef = useRef<number | null>(null);
  const audioStopTimeoutRef = useRef<number | null>(null);
  const recordingStartedRef = useRef(0);
  const audioRecordingStartedRef = useRef(0);
  const analysisBusyRef = useRef(false);
  const submitBusyRef = useRef(false);
  const mediaUploadSessionRef = useRef<PrivateRoomMediaUploadSession | null>(null);
  const ownedObjectUrlsRef = useRef(new Set<string>());
  const resetFlowRef = useRef<(nextMode: "homeowner" | "demo") => void>(() => undefined);
  const demoHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const focusDemoHeading = () => {
    if (mode === "demo") demoHeadingRef.current?.focus();
  };

  const sampleRoom = mode === "demo" ? ROOMS[sampleRoomId] : null;
  const dimensions: RoomDimensions | null = useMemo(() => {
    const draftArea = wallAreaEditing && wallAreaDraft.trim() ? Number(wallAreaDraft) : Number.NaN;
    const activeWallAreaOverride = Number.isFinite(draftArea) && draftArea >= 1 && draftArea <= 10_000
      ? draftArea
      : manualWallAreaOverride;

    if (mode === "demo") {
      const room = ROOMS[sampleRoomId];
      return {
        roomShape: "rectangular",
        lengthFt: room.lengthFt,
        widthFt: room.widthFt,
        ceilingHeightFt: room.ceilingHeightFt,
        grossWallArea: room.grossWallArea,
        openingDeductionSqFt: room.openingDeductionSqFt,
        wallArea: activeWallAreaOverride ?? room.wallArea,
        ceilingArea: room.ceilingArea,
        trimLength: room.trimLength,
        perimeterFt: room.trimLength,
        doorSides: room.doorSides,
        patchCount: room.patchCount,
      };
    }

    if (estimateSource === "homeowner_entered_net_wall_area") {
      if (activeWallAreaOverride === null) return null;
      const enteredDoorSides = measurementFields.doorSides.trim() ? Number(measurementFields.doorSides) : Number.NaN;
      const enteredPatchCount = measurementFields.patchCount.trim() ? Number(measurementFields.patchCount) : Number.NaN;
      const doorSides = doorScopeSelected && Number.isInteger(enteredDoorSides) && enteredDoorSides >= 1 && enteredDoorSides <= 20 ? enteredDoorSides : undefined;
      const patchCount = patchScopeSelected && Number.isInteger(enteredPatchCount) && enteredPatchCount >= 1 && enteredPatchCount <= 12 ? enteredPatchCount : undefined;
      return {
        roomShape,
        openingDeductionSqFt: null,
        wallArea: activeWallAreaOverride,
        ...(doorSides !== undefined ? { doorSides } : {}),
        ...(patchCount !== undefined ? { patchCount } : {}),
      };
    }

    const ceilingHeightFt = measurementFields.ceilingHeightFt.trim() ? Number(measurementFields.ceilingHeightFt) : Number.NaN;
    if (!Number.isFinite(ceilingHeightFt) || ceilingHeightFt <= 0) return null;

    let lengthFt: number | undefined;
    let widthFt: number | undefined;
    let perimeterFt: number;
    let ceilingArea: number;
    if (roomShape === "rectangular") {
      if (!measurementFields.lengthFt.trim() || !measurementFields.widthFt.trim()) return null;
      lengthFt = Number(measurementFields.lengthFt);
      widthFt = Number(measurementFields.widthFt);
      if (![lengthFt, widthFt].every(Number.isFinite) || lengthFt <= 0 || widthFt <= 0) return null;
      perimeterFt = 2 * (lengthFt + widthFt);
      ceilingArea = lengthFt * widthFt;
    } else {
      if (!measurementFields.perimeterFt.trim() || !measurementFields.ceilingAreaSqFt.trim()) return null;
      perimeterFt = Number(measurementFields.perimeterFt);
      ceilingArea = Number(measurementFields.ceilingAreaSqFt);
      if (![perimeterFt, ceilingArea].every(Number.isFinite) || perimeterFt <= 0 || ceilingArea <= 0) return null;
      if (roomShape === "square_footage_approximation") {
        const side = Math.sqrt(ceilingArea);
        lengthFt = side;
        widthFt = side;
      }
    }

    const grossWallArea = perimeterFt * ceilingHeightFt;
    const supportedOpeningArea = estimateSource === "doorway_scale" && assessment.scaleReference === "standard_door"
      ? assessment.openingDeductionSqFt
      : null;
    const openingDeductionSqFt = supportedOpeningArea !== null && supportedOpeningArea < grossWallArea
      ? supportedOpeningArea
      : null;
    const calculatedPaintableArea = Math.max(1, grossWallArea - (openingDeductionSqFt ?? 0));
    const enteredDoorSides = measurementFields.doorSides.trim() ? Number(measurementFields.doorSides) : Number.NaN;
    const enteredPatchCount = measurementFields.patchCount.trim() ? Number(measurementFields.patchCount) : Number.NaN;
    const doorSides = doorScopeSelected && Number.isInteger(enteredDoorSides) && enteredDoorSides >= 1 && enteredDoorSides <= 20 ? enteredDoorSides : undefined;
    const patchCount = patchScopeSelected && Number.isInteger(enteredPatchCount) && enteredPatchCount >= 1 && enteredPatchCount <= 12 ? enteredPatchCount : undefined;
    return {
      roomShape,
      ...(lengthFt !== undefined ? { lengthFt } : {}),
      ...(widthFt !== undefined ? { widthFt } : {}),
      ceilingHeightFt,
      grossWallArea,
      openingDeductionSqFt,
      wallArea: activeWallAreaOverride ?? calculatedPaintableArea,
      ceilingArea,
      trimLength: perimeterFt,
      perimeterFt,
      ...(doorSides !== undefined ? { doorSides } : {}),
      ...(patchCount !== undefined ? { patchCount } : {}),
    };
  }, [mode, sampleRoomId, roomShape, measurementFields, doorScopeSelected, patchScopeSelected, estimateSource, assessment.scaleReference, assessment.openingDeductionSqFt, manualWallAreaOverride, wallAreaEditing, wallAreaDraft]);

  const items = useMemo(
    () => dimensions ? buildScopeLines(dimensions, color, mode === "demo" && sampleRoom?.darkWalls ? "dark" : assessment.wallTone, transcript, mode) : [],
    [dimensions, color, mode, sampleRoom, assessment.wallTone, transcript],
  );
  const totals = useMemo(() => calculateTotals(items, scopeSelection), [items, scopeSelection]);
  const includedItems = useMemo(() => items.filter((item) => itemIsIncluded(item, scopeSelection)), [items, scopeSelection]);
  const budgetStatus = statusForBudget(totals, budgetAmount);
  const budgetCoverage = budgetAmount === null || totals.high <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((budgetAmount / totals.high) * 100)));
  const colorHexIsValid = /^#?[0-9a-f]{6}$/i.test(colorHexDraft.trim());
  const activeRoomFrames = captureMode === "video" ? videoFrames : photoAssets;
  const primaryFrameIndex = activeRoomFrames.length > 0 ? Math.floor((activeRoomFrames.length - 1) / 2) : 0;
  const primaryFrame = activeRoomFrames[primaryFrameIndex] ?? null;
  const primaryImageUrl = mode === "demo" ? sampleRoom?.image ?? "" : primaryFrame?.previewUrl ?? "";
  const primaryImageAlt = mode === "demo" ? sampleRoom?.alt ?? "Generated demo room" : "A representative frame from the homeowner's room walkthrough";
  const captureIsReady = mode === "demo"
    ? true
    : captureMode === "video"
      ? Boolean(videoAsset && videoFrames.length === 4)
      : photoAssets.length >= MIN_ROOM_PHOTOS && photoAssets.length <= MAX_ROOM_PHOTOS;
  const activeJourneyStep = mode === "demo"
    ? screen === "estimate" ? 3 : 2
    : screen === "setup" ? 1 : screen === "capture" ? 2 : screen === "analysis" || screen === "measurements" ? 3 : screen === "estimate" ? 4 : 5;
  const compactMobileStep = mode === "homeowner" && (screen === "capture" || screen === "analysis");
  const modeSwitchDisabled = recording || audioRecording || preparingVideo || analysisBusy || submitting;

  const rememberUrl = (url: string) => {
    if (url) ownedObjectUrlsRef.current.add(url);
    return url;
  };

  const releaseUrl = (url?: string | null) => {
    if (!url) return;
    revokeMediaUrl(url);
    ownedObjectUrlsRef.current.delete(url);
  };

  const stopCameraTracks = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
  };

  const stopAudioTracks = () => {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
  };

  const releaseFrames = (frames: RoomFrame[]) => frames.forEach((frame) => releaseUrl(frame.previewUrl));
  const releasePhotos = (photos: RoomImageAsset[]) => photos.forEach((photo) => releaseUrl(photo.previewUrl));

  useEffect(() => {
    if (liveVideoRef.current && cameraStream) {
      liveVideoRef.current.srcObject = cameraStream;
      void liveVideoRef.current.play().catch(() => undefined);
    }
  }, [cameraStream, screen, captureMode]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartedRef.current) / 1_000);
      setRecordingSeconds(Math.min(MAX_CAPTURED_VIDEO_SECONDS, elapsed));
      if (elapsed >= MAX_CAPTURED_VIDEO_SECONDS) {
        captureSessionRef.current?.stop();
        captureSessionRef.current = null;
        setRecording(false);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!audioRecording) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - audioRecordingStartedRef.current) / 1_000);
      setAudioRecordingSeconds(Math.min(MAX_CAPTURED_VIDEO_SECONDS, elapsed));
      if (elapsed >= MAX_CAPTURED_VIDEO_SECONDS) {
        audioSessionRef.current?.stop();
        audioSessionRef.current = null;
        setAudioRecording(false);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [audioRecording]);

  useEffect(() => () => {
    if (videoStopTimeoutRef.current !== null) window.clearTimeout(videoStopTimeoutRef.current);
    if (audioStopTimeoutRef.current !== null) window.clearTimeout(audioStopTimeoutRef.current);
    captureSessionRef.current?.stop();
    audioSessionRef.current?.stop();
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    ownedObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    ownedObjectUrlsRef.current.clear();
  }, []);

  const chooseBudget = (amount: number | null, label: string) => {
    setBudgetAmount(amount);
    setBudgetLabel(label);
    setBudgetIsCustom(false);
    if (amount !== null) setBudgetSliderValue(amount);
    setScopeMessage("");
  };

  const handleBudgetSlider = (value: string) => {
    const amount = Number(value);
    setBudgetSliderValue(amount);
    setBudgetAmount(amount);
    setBudgetLabel(money(amount));
    setBudgetIsCustom(true);
    setScopeMessage("");
  };

  const chooseWallColor = (nextColor: PaintColor) => {
    setColor(nextColor);
    setColorHexDraft(nextColor.hex.toUpperCase());
    setColorHexError("");
    setScopeMessage("");
  };

  const selectDemoRoom = (nextRoomId: RoomId) => {
    if (nextRoomId === sampleRoomId) return;
    const room = ROOMS[nextRoomId];
    const nextScope = DEMO_SCOPE_SELECTIONS[nextRoomId];
    setSampleRoomId(nextRoomId);
    setTranscript(room.spokenCue);
    setScopeSelection({ ...nextScope });
    setScopeFollowUpsOpen(true);
    setDoorScopeSelected(false);
    setPatchScopeSelected(Boolean(nextScope.patch));
    setMeasurementFields(demoMeasurementFields(nextRoomId));
    setMeasurementConfirmed(true);
    setEstimateSource("demo");
    setManualWallAreaOverride(null);
    setWallAreaEditing(false);
    setWallAreaDraft("");
    setWallAreaEditError("");
    setMeasurementError("");
    setScopeMessage("");
    setDemoMasksVisible(true);
    setSplit(52);
  };

  const updateWallColorFromHex = (value: string) => {
    setColorHexDraft(value);
    const trimmed = value.trim().toUpperCase();
    const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (/^#[0-9A-F]{6}$/.test(normalized)) {
      chooseWallColor(colorFromHex(normalized));
      setColorHexDraft(normalized);
    } else {
      setColorHexError("Enter a six-digit color such as #B7CDD0. Your last valid color stays selected.");
    }
  };

  const clearVideoDraft = () => {
    if (videoAsset) releaseUrl(videoAsset.previewUrl);
    releaseFrames(videoFrames);
    setVideoAsset(null);
    setVideoFrames([]);
    setPreparingVideo(false);
    setRecordingSeconds(0);
  };

  const openCamera = async (): Promise<MediaStream | null> => {
    setCameraError("");
    setCaptureError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setCameraError("Camera recording is unavailable here. Use 3–4 photos instead.");
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      return stream;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setCameraError(name === "NotAllowedError" || name === "SecurityError"
        ? "Allow camera and microphone access, or use 3–4 photos instead."
        : name === "NotFoundError"
          ? "No camera was found. Use 3–4 photos instead."
          : "The camera could not start. Check its permission or use 3–4 photos.");
      return null;
    }
  };

  const beginVideoCapture = async () => {
    setCaptureError("");
    setCameraError("");
    let activeStream = cameraStreamRef.current ?? cameraStream;
    if (!activeStream) activeStream = await openCamera();
    if (!activeStream) return;

    if (videoStopTimeoutRef.current !== null) window.clearTimeout(videoStopTimeoutRef.current);
    try {
      const session = beginVideoWalkthrough(activeStream, liveVideoRef.current ?? undefined);
      captureSessionRef.current = session;
      recordingStartedRef.current = Date.now();
      setRecordingSeconds(0);
      setRecording(true);
      videoStopTimeoutRef.current = window.setTimeout(() => {
        captureSessionRef.current?.stop();
        captureSessionRef.current = null;
        setRecording(false);
      }, MAX_CAPTURED_VIDEO_SECONDS * 1_000);
      void session.result.then(async (captured) => {
        if (videoStopTimeoutRef.current !== null) window.clearTimeout(videoStopTimeoutRef.current);
        videoStopTimeoutRef.current = null;
        setRecording(false);
        captureSessionRef.current = null;
        stopCameraTracks();
        if (captured.videoBlob.size > MAX_VIDEO_CAPTURE_BYTES) {
          setCaptureError("This browser could not prepare a saveable walkthrough. Try again or use 3–4 photos.");
          return;
        }
        const previewUrl = rememberUrl(URL.createObjectURL(captured.videoBlob));
        setVideoAsset({ ...captured, previewUrl });
        setPreparingVideo(true);
        try {
          const extracted = await extractRepresentativeFrames(captured.videoBlob, captured.durationSeconds);
          extracted.frames.forEach((frame) => rememberUrl(frame.previewUrl));
          releaseFrames(videoFrames);
          setVideoFrames(extracted.frames);
          setRecordingSeconds(Math.round(extracted.durationSeconds));
          setCaptureError("");
        } catch (error) {
          const reason = error instanceof Error ? error.message : "";
          setCaptureError(reason === "video-size-invalid"
            ? "This browser could not prepare a saveable walkthrough. Try again or use 3–4 photos."
            : reason === "video-duration-invalid"
              ? "This recording could not be checked. Try again or use 3–4 photos."
              : "WalkQuote could not read this video. Try again or use 3–4 photos.");
        } finally {
          setPreparingVideo(false);
        }
      }).catch(() => {
        setRecording(false);
        setPreparingVideo(false);
        captureSessionRef.current = null;
        stopCameraTracks();
        setCaptureError("The recording stopped unexpectedly. Try again or use 3–4 photos.");
      });
    } catch {
      setRecording(false);
      setPreparingVideo(false);
      stopCameraTracks();
      setCaptureError("Recording could not start. Check camera and microphone access, or use 3–4 photos.");
    }
  };

  const stopVideoCapture = () => {
    if (videoStopTimeoutRef.current !== null) window.clearTimeout(videoStopTimeoutRef.current);
    videoStopTimeoutRef.current = null;
    captureSessionRef.current?.stop();
    captureSessionRef.current = null;
    setRecording(false);
  };

  const recordAgain = async () => {
    clearVideoDraft();
    setCameraError("");
    await beginVideoCapture();
  };

  const onPhotoFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selectedFiles.length) return;
    setPhotoError("");
    const remaining = MAX_ROOM_PHOTOS - photoAssets.length;
    if (remaining <= 0) {
      setPhotoError("You can use up to four photos. Remove one before adding another.");
      return;
    }
    if (selectedFiles.length > remaining) {
      setPhotoError(`Choose no more than ${remaining} more photo${remaining === 1 ? "" : "s"}. The estimate uses three or four angles.`);
      return;
    }
    const compressed: RoomImageAsset[] = [];
    try {
      for (const file of selectedFiles) compressed.push(await compressRoomPhoto(file));
      compressed.forEach((photo) => rememberUrl(photo.previewUrl));
      setPhotoAssets((current) => [...current, ...compressed]);
      setCaptureError("");
    } catch (error) {
      releasePhotos(compressed);
      const reason = error instanceof Error ? error.message : "";
      setPhotoError(reason === "photo-format-or-size-invalid"
        ? "Choose a supported image under 24 MB. Large photos are compressed in this browser before analysis."
        : reason === "photo-could-not-open"
          ? "One photo could not be opened. Try a JPEG or PNG image, or take a new photo."
          : "One photo could not be compressed. Try a smaller image or use the video option.");
    }
  };

  const removePhoto = (id: string) => {
    const removed = photoAssets.find((photo) => photo.id === id);
    const next = photoAssets.filter((photo) => photo.id !== id);
    if (removed) releaseUrl(removed.previewUrl);
    setPhotoAssets(next);
    setPhotoError("");
  };

  const startAudioNote = async () => {
    setAudioError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAudioError("Voice notes are not available in this browser. Type the work you want done, or continue with the photos.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      audioStreamRef.current = stream;
      const session = beginAudioNoteCapture(stream);
      audioSessionRef.current = session;
      audioRecordingStartedRef.current = Date.now();
      setAudioRecordingSeconds(0);
      setAudioRecording(true);
      audioStopTimeoutRef.current = window.setTimeout(() => {
        audioSessionRef.current?.stop();
        audioSessionRef.current = null;
        setAudioRecording(false);
      }, MAX_CAPTURED_VIDEO_SECONDS * 1_000);
      void session.result.then((blob) => {
        if (audioStopTimeoutRef.current !== null) window.clearTimeout(audioStopTimeoutRef.current);
        audioStopTimeoutRef.current = null;
        audioSessionRef.current = null;
        setAudioRecording(false);
        stopAudioTracks();
        if (blob.size > MAX_AUDIO_NOTE_BYTES) {
          setAudioError("That note is too large to process. Record a shorter room description.");
          return;
        }
        if (audioNote) releaseUrl(audioNote.previewUrl);
        const previewUrl = rememberUrl(URL.createObjectURL(blob));
        setAudioNote({ blob, previewUrl, mimeType: blob.type || "audio/webm", size: blob.size });
      }).catch(() => {
        setAudioRecording(false);
        audioSessionRef.current = null;
        stopAudioTracks();
        setAudioError("The microphone note did not finish. Try again or type the work you want done.");
      });
    } catch (error) {
      const reason = error instanceof DOMException ? error.name : "";
      setAudioError(reason === "NotAllowedError" || reason === "SecurityError"
        ? "Microphone permission was denied. Allow it in your browser settings, then try again or type your room note."
        : "The microphone could not start. Type the work you want done, or continue with the photos.");
    }
  };

  const stopAudioNote = () => {
    if (audioStopTimeoutRef.current !== null) window.clearTimeout(audioStopTimeoutRef.current);
    audioStopTimeoutRef.current = null;
    audioSessionRef.current?.stop();
    audioSessionRef.current = null;
    setAudioRecording(false);
  };

  const removeAudioNote = () => {
    if (audioNote) releaseUrl(audioNote.previewUrl);
    setAudioNote(null);
    setAudioError("");
  };

  const requestAnalysisStage = useCallback(async (payload: AnalyzeRoomRequest, attemptId: string) => {
    const result = await analyzeRoom({ ...payload, attemptId }) as AnalysisReply;
    if (!result || typeof result !== "object" || result.error || result.errorCode) {
      const message = typeof result?.message === "string"
        ? result.message
        : typeof result?.error === "string"
          ? result.error
          : "Room analysis did not finish. Please try again.";
      throw new AnalysisStageError(message, result?.errorCode, result?.resetsAt);
    }
    return result;
  }, []);

  const setAnalysisStep = (index: number, status: AnalysisStatus) => {
    setAnalysisStatuses((current) => current.map((item, position) => position === index ? status : item));
  };

  const startAnalysis = async () => {
    if (mode !== "homeowner") return;
    if (mode === "homeowner") {
      if (!analysisConsent) {
        setCaptureError("Confirm the analysis consent before sending selected frames or a spoken note for review.");
        return;
      }
      if (captureMode === "video" && (!videoAsset || videoFrames.length !== 4)) {
        setCaptureError("Record a walkthrough and wait for its four analysis frames, or switch to the photo option.");
        return;
      }
      if (captureMode === "photos" && (photoAssets.length < MIN_ROOM_PHOTOS || photoAssets.length > MAX_ROOM_PHOTOS)) {
        setPhotoError("Add three or four room photos before starting the estimate.");
        return;
      }
    }
    if (analysisBusyRef.current) return;

    const attemptId = crypto.randomUUID();
    const sourceId: AnalysisSourceId = mode === "demo" ? sampleRoomId : "homeowner";
    analysisBusyRef.current = true;
    setAnalysisBusy(true);
    setAnalysisError("");
    setAnalysisErrorCode(null);
    setMask(null);
    setTrimMask(null);
    setOpeningMask(null);
    setMaskUnavailable(false);
    setObservations([]);
    setAssessment({ visibleDoorCount: null, visibleWindowCount: null, visibleMarkCount: null, wallTone: "unknown", scaleReference: "none", suggestedDimensions: null, openingDeductionSqFt: null });
    setAnalysisStatuses(["pending", "pending", "pending", "pending"]);
    setScreen("analysis");

    let noteForAnalysis = mode === "demo" ? ROOMS[sampleRoomId].spokenCue : cleanRoomNote(scopeNote);
    let frameDataUrls: string[] = [];
    let activeStep = 0;

    try {
      if (mode === "homeowner") {
        const activeFrames = captureMode === "video" ? videoFrames : photoAssets;
        frameDataUrls = await Promise.all(activeFrames.map((frame) => blobToDataUrl(frame.blob)));
        const audioToTranscribe = captureMode === "video" ? videoAsset?.audioBlob ?? null : audioNote?.blob ?? null;
        if (audioToTranscribe) {
          activeStep = 0;
          setCurrentAnalysisStep(0);
          setAnalysisStep(0, "working");
          const wavBase64 = await audioBlobToWavBase64(audioToTranscribe);
          const transcription = await requestAnalysisStage({ stage: "transcribe", sourceId, audioBase64: wavBase64 }, attemptId);
          const spoken = cleanRoomNote(transcription.transcript ?? "");
          noteForAnalysis = spoken || noteForAnalysis;
          setTranscript(noteForAnalysis);
          setAnalysisStep(0, spoken ? "done" : noteForAnalysis ? "done" : "skipped");
        } else {
          setTranscript(noteForAnalysis);
          setAnalysisStep(0, noteForAnalysis ? "done" : "skipped");
        }
      } else {
        setTranscript(noteForAnalysis);
        setAnalysisStep(0, "skipped");
      }

      activeStep = 1;
      setCurrentAnalysisStep(1);
      setAnalysisStep(1, "working");
      const observationPayload: AnalyzeRoomRequest = {
        stage: "observe",
        sourceId,
        ...(mode === "homeowner" ? { frames: frameDataUrls } : {}),
        ...(noteForAnalysis ? { transcript: noteForAnalysis } : {}),
      };
      const observationResult = await requestAnalysisStage(observationPayload, attemptId);
      const safeObservations = Array.isArray(observationResult.observations)
        ? observationResult.observations.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 5)
        : [];
      setObservations(safeObservations);
      const scaleReference = observationResult.scaleReference === "standard_door" ? "standard_door" : "none";
      const suggested = observationResult.suggestedDimensions && scaleReference === "standard_door"
        ? observationResult.suggestedDimensions
        : null;
      const nextAssessment: RoomAssessment = {
        visibleDoorCount: clampCount(observationResult.visibleDoorCount, 20),
        visibleWindowCount: clampCount(observationResult.visibleWindowCount, 20),
        visibleMarkCount: clampCount(observationResult.visibleMarkCount, 12),
        wallTone: observationResult.wallTone === "dark" || observationResult.wallTone === "medium" || observationResult.wallTone === "light" ? observationResult.wallTone : "unknown",
        scaleReference: suggested ? "standard_door" : "none",
        suggestedDimensions: suggested,
        openingDeductionSqFt: suggested ? clampArea(observationResult.openingDeductionSqFt) : null,
      };
      setAssessment(nextAssessment);
      setAnalysisStep(1, "done");

      activeStep = 2;
      setCurrentAnalysisStep(2);
      setAnalysisStep(2, "working");
      const segmentPayload: AnalyzeRoomRequest = {
        stage: "segment",
        sourceId,
        ...(mode === "homeowner" ? { frames: frameDataUrls } : {}),
      };
      try {
        const maskResult = await requestAnalysisStage(segmentPayload, attemptId);
        const [wall, trim, openings] = await Promise.all([
          decodeOptionalMask(maskResult.maskText),
          decodeOptionalMask(maskResult.trimMaskText),
          decodeOptionalMask(maskResult.openingMaskText),
        ]);
        setMask(wall);
        setTrimMask(trim);
        setOpeningMask(openings);
        setMaskUnavailable(!wall);
        if (!wall && !trim && !openings) throw new Error("segmentation-output-empty");
        setAnalysisStep(2, "done");
      } catch {
        setMask(null);
        setTrimMask(null);
        setOpeningMask(null);
        setMaskUnavailable(true);
        setAnalysisStep(2, "skipped");
      }

      activeStep = 3;
      setCurrentAnalysisStep(3);
      setAnalysisStep(3, "working");
      await new Promise((resolve) => window.setTimeout(resolve, reduceMotion ? 0 : 220));
      setAnalysisStep(3, "done");

      setManualWallAreaOverride(null);
      setWallAreaEditing(false);
      setWallAreaDraft("");
      setWallAreaEditError("");
      if (mode === "demo") {
        const room = ROOMS[sampleRoomId];
        setEstimateSource("demo");
        setRoomShape("rectangular");
        setDoorScopeSelected(false);
        setPatchScopeSelected(false);
        setScopeFollowUpsOpen(false);
        setMeasurementFields({
          lengthFt: String(room.lengthFt),
          widthFt: String(room.widthFt),
          perimeterFt: String(room.trimLength),
          ceilingAreaSqFt: String(room.ceilingArea),
          ceilingHeightFt: String(room.ceilingHeightFt),
          doorSides: String(room.doorSides),
          patchCount: String(room.patchCount),
        });
        setMeasurementConfirmed(true);
      } else {
        setEstimateSource(suggested ? "doorway_scale" : "homeowner_entered_net_wall_area");
        setRoomShape("rectangular");
        setDoorScopeSelected(false);
        setPatchScopeSelected(false);
        setScopeFollowUpsOpen(hasOptionalScopeCue(nextAssessment, noteForAnalysis));
        setMeasurementFields({
          lengthFt: suggested ? String(suggested.lengthFt) : "",
          widthFt: suggested ? String(suggested.widthFt) : "",
          perimeterFt: "",
          ceilingAreaSqFt: "",
          ceilingHeightFt: suggested ? String(suggested.ceilingHeightFt) : "",
          doorSides: "",
          patchCount: "",
        });
        setMeasurementConfirmed(Boolean(suggested));
        setWallAreaEditing(!suggested);
      }
      setMeasurementError("");
      setScopeSelection({});
      setScreen(mode === "demo" ? "measurements" : suggested ? "estimate" : "measurements");
    } catch (caught) {
      const stageError = caught instanceof AnalysisStageError ? caught : null;
      setAnalysisStep(activeStep, "error");
      setCurrentAnalysisStep(activeStep);
      setAnalysisErrorCode(stageError?.code ?? null);
      const limitTime = formatLimitResetTime(stageError?.resetsAt);
      const serviceMessage = stageError?.code === "VISITOR_DAILY_LIMIT"
        ? `This connection has reached its daily limit of three estimate runs. Try again after ${limitTime}.`
        : stageError?.code === "SITE_DAILY_LIMIT"
          ? `WalkQuote has reached its daily pilot limit of 25 estimate runs. Try again after ${limitTime}.`
          : stageError?.code === "USAGE_IDENTITY_UNAVAILABLE"
            ? "We could not safely verify this connection's daily estimate limit, so analysis did not start. Try again later."
            : stageError?.code === "USAGE_LIMIT_UNAVAILABLE"
              ? "The estimate service cannot safely start right now. Try again in a little while."
              : stageError?.code === "STAGE_ALREADY_USED"
                ? "This analysis stage was already submitted. Start a fresh analysis to try again."
                : stageError?.code === "ATTEMPT_INVALID"
                  ? "This analysis attempt could not be verified. Start a fresh analysis to continue."
                  : null;
      setAnalysisError(serviceMessage ?? (activeStep === 0
        ? "The spoken note could not be transcribed. Try recording again, or remove the note and continue with the selected images."
        : activeStep === 1
          ? "The room observations did not return in a usable format. Start a fresh analysis to retry."
          : "The analysis could not finish. Start a fresh analysis to retry."));
    } finally {
      setAnalysisBusy(false);
      analysisBusyRef.current = false;
    }
  };

  const resetFlow = (nextMode: "homeowner" | "demo" = "homeowner") => {
    if (videoStopTimeoutRef.current !== null) window.clearTimeout(videoStopTimeoutRef.current);
    if (audioStopTimeoutRef.current !== null) window.clearTimeout(audioStopTimeoutRef.current);
    videoStopTimeoutRef.current = null;
    audioStopTimeoutRef.current = null;
    stopCameraTracks();
    stopAudioTracks();
    captureSessionRef.current?.stop();
    audioSessionRef.current?.stop();
    captureSessionRef.current = null;
    audioSessionRef.current = null;
    if (videoAsset) releaseUrl(videoAsset.previewUrl);
    if (audioNote) releaseUrl(audioNote.previewUrl);
    releasePhotos(photoAssets);
    releaseFrames(videoFrames);
    setMode(nextMode);
    setScreen(nextMode === "demo" ? "demo-inspector" : "setup");
    setSampleRoomId("living");
    setCaptureMode("video");
    setBudgetAmount(1500);
    setBudgetLabel("$1,500");
    setBudgetSliderValue(1500);
    setBudgetIsCustom(false);
    const startingColor = nextMode === "demo" ? DEMO_COLORS[0] : COLORS[0];
    setColor({ name: startingColor.name, hex: startingColor.hex });
    setColorHexDraft(startingColor.hex.toUpperCase());
    setColorHexError("");
    setVideoAsset(null);
    setPreparingVideo(false);
    setAudioNote(null);
    setPhotoAssets([]);
    setVideoFrames([]);
    setAnalysisConsent(false);
    setMediaShareConsent(false);
    setScopeNote("");
    setTranscript(nextMode === "demo" ? DEMO_TRANSCRIPT : "");
    setObservations([]);
    setAssessment({ visibleDoorCount: null, visibleWindowCount: null, visibleMarkCount: null, wallTone: "unknown", scaleReference: "none", suggestedDimensions: null, openingDeductionSqFt: null });
    setMask(null);
    setTrimMask(null);
    setOpeningMask(null);
    setMaskUnavailable(false);
    setAnalysisStatuses(["pending", "pending", "pending", "pending"]);
    setAnalysisError("");
    setAnalysisErrorCode(null);
    setRoomShape("rectangular");
    setEstimateSource(nextMode === "demo" ? "demo" : "homeowner_entered_net_wall_area");
    setManualWallAreaOverride(null);
    setWallAreaEditing(false);
    setWallAreaDraft("");
    setWallAreaEditError("");
    setDoorScopeSelected(false);
    setPatchScopeSelected(nextMode === "demo");
    setScopeFollowUpsOpen(nextMode === "demo");
    setMeasurementFields(nextMode === "demo"
      ? {
          lengthFt: String(ROOMS.living.lengthFt),
          widthFt: String(ROOMS.living.widthFt),
          perimeterFt: String(ROOMS.living.trimLength),
          ceilingAreaSqFt: String(ROOMS.living.ceilingArea),
          ceilingHeightFt: String(DEMO_SPATIAL_MATH.ceilingHeightFt),
          doorSides: String(ROOMS.living.doorSides),
          patchCount: String(ROOMS.living.patchCount),
        }
      : { lengthFt: "", widthFt: "", perimeterFt: "", ceilingAreaSqFt: "", ceilingHeightFt: "", doorSides: "", patchCount: "" });
    setMeasurementConfirmed(nextMode === "demo");
    setMeasurementError("");
    setWallAreaEditError("");
    setName("");
    setPhone("");
    setZipCode("");
    setFormError("");
    setSetupError("");
    setCaptureError("");
    setPhotoError("");
    setAudioError("");
    setCameraError("");
    setScopeSelection(nextMode === "demo" ? { ceiling: false, trim: false, doors: false, patch: true } : {});
    setScopeMessage("");
    setDemoMasksVisible(true);
    setSplit(52);
    submitBusyRef.current = false;
    setAnalysisBusy(false);
    analysisBusyRef.current = false;
    setSubmitting(false);
    setRecording(false);
    setRecordingSeconds(0);
    setAudioRecording(false);
    setAudioRecordingSeconds(0);
    mediaUploadSessionRef.current = null;
  };

  resetFlowRef.current = resetFlow;

  useEffect(() => {
    const requestedExperience = new URLSearchParams(location.search).get("experience");
    resetFlowRef.current(requestedExperience === "demo" ? "demo" : "homeowner");
  }, [location.search]);

  const continueFromSetup = () => {
    setSetupError("");
    setScreen("capture");
  };

  const fitBudget = () => {
    if (budgetAmount === null) {
      setScopeMessage("Choose a target budget first. The suggestion only removes optional work.");
      return;
    }
    const fit = bestBudgetFit(items, scopeSelection, budgetAmount);
    setScopeSelection(fit.selection);
    if (fit.fits) {
      const removed = items.filter((item) => !item.required && itemIsIncluded(item, scopeSelection) && !itemIsIncluded(item, fit.selection));
      setScopeMessage(removed.length === 0
        ? "The current selected scope already fits under this target."
        : `Removed ${removed.map((item) => item.label.toLowerCase()).join(" and ")}. The upper range is now ${money(fit.totals.high)}.`);
    } else {
      setScopeMessage(`Required wall work remains ${moneyRange(fit.totals.low, fit.totals.high)}. The suggestion kept it in the estimate.`);
    }
  };

  const toggleScope = (item: ScopeLine) => {
    if (item.required) return;
    const nextIncluded = !itemIsIncluded(item, scopeSelection);
    if (item.id === "doors") setDoorScopeSelected(nextIncluded);
    if (item.id === "patch") setPatchScopeSelected(nextIncluded);
    setScopeSelection((current) => ({ ...current, [item.id]: nextIncluded }));
    setScopeMessage("");
  };

  const updateMeasurement = (key: keyof typeof measurementFields, value: string) => {
    setMeasurementFields((current) => ({ ...current, [key]: value }));
    setMeasurementError("");
    setScopeMessage("");
  };

  const updateDoorScopeSelection = (selected: boolean) => {
    setDoorScopeSelected(selected);
    setMeasurementError("");
    setScopeSelection((current) => ({ ...current, doors: selected }));
  };

  const updatePatchScopeSelection = (selected: boolean) => {
    setPatchScopeSelected(selected);
    setMeasurementError("");
    setScopeSelection((current) => ({ ...current, patch: selected }));
  };

  const startWallAreaEdit = () => {
    if (estimateSource === "homeowner_entered_net_wall_area") {
      setWallAreaDraft(manualWallAreaOverride !== null ? String(Number(manualWallAreaOverride.toFixed(1))) : "");
      setWallAreaEditError("");
      setWallAreaEditing(true);
      return;
    }
    if (!dimensions) return;
    setWallAreaDraft(String(Number(dimensions.wallArea.toFixed(1))));
    setWallAreaEditError("");
    setWallAreaEditing(true);
  };

  const saveWallAreaEdit = (): boolean => {
    const value = Number(wallAreaDraft.trim());
    if (!Number.isFinite(value) || value < 1 || value > 10_000) {
      setWallAreaEditError("Enter paintable wall area from 1 to 10,000 sq ft.");
      return false;
    }
    setManualWallAreaOverride(value);
    if (estimateSource === "homeowner_entered_net_wall_area") setMeasurementConfirmed(true);
    setWallAreaEditing(false);
    setWallAreaDraft("");
    setWallAreaEditError("");
    setMeasurementError("");
    setScopeMessage("");
    return true;
  };

  const cancelWallAreaEdit = () => {
    setWallAreaEditing(false);
    setWallAreaDraft("");
    setWallAreaEditError("");
  };

  const useCalculatedWallArea = () => {
    setManualWallAreaOverride(null);
    setWallAreaEditing(false);
    setWallAreaDraft("");
    setWallAreaEditError("");
    setScopeMessage("");
  };

  const continueFromAreaReview = () => {
    if (!primaryFrame?.previewUrl) {
      setMeasurementError("No analyzed room frame is available. Return to capture and add three or four clear photos or record a new walkthrough.");
      return;
    }
    if (wallAreaEditing) {
      setWallAreaEditError("Save or cancel the wall-area edit before continuing.");
      return;
    }
    if (!dimensions || !measurementConfirmed) {
      setWallAreaEditError("Enter and save a positive approximate net wall area before continuing.");
      setWallAreaEditing(true);
      setWallAreaDraft("");
      return;
    }
    setMeasurementError("");
    setScreen("estimate");
  };

  const continueToContact = () => {
    if (mode !== "homeowner") {
      setScreen("demo-inspector");
      return;
    }
    if (wallAreaEditing && !saveWallAreaEdit()) return;
    if (!dimensions || !measurementConfirmed) {
      setMeasurementError("Enter and save a positive approximate net wall area before continuing.");
      setScreen("measurements");
      return;
    }
    setFormError("");
    setScreen("contact");
  };

  const backFromEstimate = () => {
    if (wallAreaEditing && !saveWallAreaEdit()) return;
    setScreen(mode === "demo" ? "demo-inspector" : estimateSource === "doorway_scale" ? "capture" : "measurements");
  };

  const setDemoDimensions = () => {
    const room = ROOMS[sampleRoomId];
    setRoomShape("rectangular");
    setMeasurementFields({ lengthFt: String(room.lengthFt), widthFt: String(room.widthFt), perimeterFt: String(room.trimLength), ceilingAreaSqFt: String(room.ceilingArea), ceilingHeightFt: String(room.ceilingHeightFt), doorSides: String(room.doorSides), patchCount: String(room.patchCount) });
    setMeasurementConfirmed(true);
    // Keep the demo defaults from resetFlow, including any quote edits made before returning here.
    setScreen("estimate");
  };

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode !== "homeowner") {
      setFormError("Sample demo quotes stay in the walkthrough and cannot be sent as a contractor request.");
      return;
    }
    setFormError("");
    const cleanName = name.trim().replace(/\s+/g, " ");
    const cleanZip = zipCode.trim();
    if (cleanName.length < 2) {
      setFormError("Enter your name so Demo Painting Co. can identify the request.");
      return;
    }
    if (!phone || !isValidPhoneNumber(phone)) {
      setFormError("Enter a valid phone number with its country code.");
      return;
    }
    if (!/^\d{5}(?:-\d{4})?$/.test(cleanZip)) {
      setFormError("Enter a five-digit ZIP code, or a ZIP+4 code.");
      return;
    }
    if (!mediaShareConsent) {
      setFormError("Confirm that you want to share this request and its selected media with Demo Painting Co.");
      return;
    }
    if (!dimensions || !measurementConfirmed) {
      setFormError("The approximate estimate is not ready. Return to frame review and enter a valid net wall area.");
      return;
    }
    if (mode === "homeowner" && (!analysisConsent || (captureMode === "video" ? !videoAsset || videoFrames.length !== 4 : photoAssets.length < MIN_ROOM_PHOTOS || photoAssets.length > MAX_ROOM_PHOTOS))) {
      setFormError("The selected media is incomplete. Return to capture and finish the room walkthrough.");
      return;
    }
    if (submitBusyRef.current) return;

    submitBusyRef.current = true;
    setSubmitting(true);
    const nameParts = cleanName.split(" ");
    const selectedScope = includedItems.map((item) => item.id);
    const finalTotals = calculateTotals(items, scopeSelection);
    const homeownerWallAreaOnly = mode === "homeowner" && estimateSource === "homeowner_entered_net_wall_area";
    const assumptions = mode === "demo"
      ? [
          "Sample room quantities are illustrative and are not homeowner measurements.",
          "The generated image and visible clues are demo material only.",
          `The price range uses the supplied price book and an ${PRICE_BOOK.taxAndConsumables.label} tax and consumables assumption.`,
          "A contractor confirms scope and local site conditions before a final quote.",
        ]
      : [
          estimateSource === "doorway_scale"
            ? "Room dimensions are low-confidence visual estimates from a visible, apparently standard 80-inch (6 ft 8 in) interior doorway; this is not a physical survey."
            : `The homeowner entered ${formatDimensionValue(dimensions.wallArea)} sq ft as an approximate net paintable wall area. This figure does not establish physical room dimensions.`,
          homeownerWallAreaOnly
            ? "Gross wall area and opening deductions were not calculated; the homeowner entered a net wall-area approximation directly."
            : dimensions.openingDeductionSqFt !== null
              ? `A supported approximate visible door/window opening deduction of ${formatDimensionValue(dimensions.openingDeductionSqFt)} sq ft was subtracted from gross wall area.`
              : "No door or window area was deducted because the submitted views did not support a reliable opening estimate.",
          homeownerWallAreaOnly
            ? "The entered wall area is used for wall and any applicable primer pricing only."
            : manualWallAreaOverride !== null
              ? `The homeowner edited paintable wall area to ${formatDimensionValue(dimensions.wallArea)} sq ft; this edited net area is used for wall and primer pricing.`
              : "Paintable wall area uses gross wall area less any supported approximate opening deduction.",
          homeownerWallAreaOnly
            ? "Ceiling area, room perimeter, and trim quantity were not estimated and are not priced."
            : "Trim length uses the estimated room perimeter as an approximate baseboard allowance.",
          `The ${PRICE_BOOK.taxAndConsumables.label} tax and consumables figure is the supplied planning assumption, not a local tax calculation.`,
          "A contractor must confirm scope, surface conditions, and the stated on-site moisture and lead checks.",
        ];
    const lineItemRanges = includedItems.map((item) => `${item.label} · ${Math.round(item.quantity)} ${item.unit} · ${moneyRange(item.low, item.high)}`);
    lineItemRanges.push(`Tax and consumables assumption · ${PRICE_BOOK.taxAndConsumables.label} · ${moneyRange(finalTotals.taxLow, finalTotals.taxHigh)}`);
    const consentTimestamp = new Date().toISOString();
    let contactWasUpserted = false;

    try {
      let mediaManifest: RoomEstimateMediaManifest | undefined;
      if (mode === "homeowner") {
        const mediaAssets: PrivateRoomMediaAssetInput[] = [];
        if (captureMode === "video" && videoAsset) {
          mediaAssets.push({ role: "walkthrough_video", blob: videoAsset.videoBlob, mimeType: videoAsset.mimeType });
          videoFrames.forEach((frame) => mediaAssets.push({ role: "analysis_frame", blob: frame.blob, mimeType: frame.mimeType }));
        } else if (captureMode === "photos") {
          photoAssets.forEach((photo) => mediaAssets.push({ role: "photo", blob: photo.blob, mimeType: photo.mimeType }));
          if (audioNote) mediaAssets.push({ role: "spoken_note", blob: audioNote.blob, mimeType: audioNote.mimeType });
        }

        const uploadSession = mediaUploadSessionRef.current ?? new PrivateRoomMediaUploadSession();
        mediaUploadSessionRef.current = uploadSession;
        mediaManifest = await uploadSession.uploadAssets(mediaAssets, {
          primaryFrameRole: captureMode === "video" ? "analysis_frame" : "photo",
          primaryFrameIndex,
          analysisConsent,
          mediaShareConsent,
          mediaConsentAt: consentTimestamp,
        });
      }

      const crmResult = await contacts({
        first_name: nameParts[0],
        ...(nameParts.length > 1 ? { last_name: nameParts.slice(1).join(" ") } : {}),
        phone,
        tags: ["walkquote", "estimate"],
        contact_stage: "lead",
        source: mode === "demo" ? "WalkQuote demo estimate" : "WalkQuote homeowner estimate",
        append_notes: `Requested a ${mode === "demo" ? "sample" : captureMode} interior painting and minor drywall estimate. Budget: ${budgetAmount === null ? "show market price" : budgetLabel}.`,
      }) as {
        id?: string;
        contact_id?: string;
        contact?: { id?: string; contact_id?: string };
      } | null;
      contactWasUpserted = true;
      const contactReference = crmResult?.contact_id ?? crmResult?.id ?? crmResult?.contact?.contact_id ?? crmResult?.contact?.id ?? "";

      await RoomEstimate.create({
        estimate_mode: mode,
        capture_mode: mode === "demo" ? "demo" : captureMode,
        ...(mode === "demo" ? { sample_room: sampleRoomId } : {}),
        sample_dimensions: mode === "demo" ? ROOMS[sampleRoomId].dimensions : roomDimensionsLabel(dimensions),
        ...(mode === "demo" ? { room_shape: "rectangular" as const } : homeownerWallAreaOnly ? {} : { room_shape: roomShape }),
        ...(typeof dimensions.perimeterFt === "number" ? { room_perimeter_ft: dimensions.perimeterFt } : {}),
        media_storage_mode: mode === "homeowner" ? "protected_chunk_records" : "demo_only",
        media_kind: mode === "demo" ? "demo" : captureMode,
        ...(mediaManifest ? { media_manifest: mediaManifest } : {}),
        ...(mode === "homeowner" ? { primary_frame_index: primaryFrameIndex } : {}),
        media_references: mode === "demo" ? [] : ["media_manifest"],
        analysis_consent: mode === "homeowner" ? analysisConsent : false,
        media_share_consent: mediaShareConsent,
        media_consent_at: consentTimestamp,
        transcript: cleanRoomNote(transcript),
        visual_observations: observations.slice(0, 5),
        visible_door_count: assessment.visibleDoorCount ?? 0,
        visible_window_count: assessment.visibleWindowCount ?? 0,
        visible_mark_count: assessment.visibleMarkCount ?? 0,
        wall_tone: mode === "demo" ? (sampleRoom?.darkWalls ? "dark" : "light") : assessment.wallTone,
        scale_reference: mode === "demo" ? "illustrative_demo" : estimateSource === "doorway_scale" ? "standard_door_80in_approx" : "none",
        measurement_source: mode === "demo" ? "sample_preset" : estimateSource,
        measurement_confidence: mode === "demo"
          ? "Illustrative sample quantities from a generated demo room."
          : estimateSource === "doorway_scale"
            ? "Low-confidence visual estimate using an apparently standard 80-inch interior doorway as a rough scale reference; contractor review needed."
            : "Homeowner-entered approximation of net paintable wall area; it does not establish room dimensions. Ceiling, perimeter, and trim quantities are not supported.",
        ...(dimensions.lengthFt !== undefined ? { room_length_ft: dimensions.lengthFt } : {}),
        ...(dimensions.widthFt !== undefined ? { room_width_ft: dimensions.widthFt } : {}),
        ...(typeof dimensions.ceilingHeightFt === "number" ? { ceiling_height_ft: dimensions.ceilingHeightFt } : {}),
        ...(typeof dimensions.grossWallArea === "number" ? { gross_wall_area_sqft: dimensions.grossWallArea } : {}),
        ...(dimensions.openingDeductionSqFt !== null ? { opening_deduction_sqft: dimensions.openingDeductionSqFt } : {}),
        wall_area_sqft: dimensions.wallArea,
        paintable_area_manually_edited: !homeownerWallAreaOnly && manualWallAreaOverride !== null,
        ...(typeof dimensions.ceilingArea === "number" ? { ceiling_area_sqft: dimensions.ceilingArea } : {}),
        ...(typeof dimensions.trimLength === "number" ? { trim_length_ft: dimensions.trimLength } : {}),
        ...(dimensions.doorSides !== undefined ? { door_sides: dimensions.doorSides } : {}),
        ...(dimensions.patchCount !== undefined ? { patch_count: dimensions.patchCount } : {}),
        budget_label: budgetAmount === null ? "Show market price" : budgetIsCustom ? money(budgetAmount) : budgetLabel,
        budget_amount: budgetAmount ?? 0,
        selected_scope: selectedScope,
        line_item_ranges: lineItemRanges,
        estimate_assumptions: assumptions,
        subtotal_low: finalTotals.subtotalLow,
        subtotal_high: finalTotals.subtotalHigh,
        tax_rate: PRICE_BOOK.taxAndConsumables.rate,
        low_total: finalTotals.low,
        high_total: finalTotals.high,
        color_name: color.name,
        color_hex: color.hex,
        contact_reference: contactReference,
        contact_name: cleanName,
        contact_phone: phone,
        zip_code: cleanZip,
        status: "new",
      } as RoomEstimateRecord & { room_shape?: RoomShape; room_perimeter_ft?: number });
      setScreen("complete");
    } catch (error) {
      if (error instanceof PrivateRoomMediaError) {
        setFormError(error.message);
      } else if (contactWasUpserted) {
        setFormError("The estimate did not finish saving. Your contact may already be in the contractor CRM. Keep this page open and retry; confirmed media parts will be reused.");
      } else if (mode === "homeowner") {
        setFormError("The request could not finish saving. Keep this page open and retry; confirmed media parts will be reused.");
      } else {
        setFormError("The request could not finish saving. Check your connection and try again.");
      }
    } finally {
      submitBusyRef.current = false;
      setSubmitting(false);
    }
  };

  const renderSetup = () => (
    <BudgetSetup key="setup"
      motionProps={pageMotion(reduceMotion)}
      budgetAmount={budgetAmount}
      budgetLabel={budgetLabel}
      budgetIsCustom={budgetIsCustom}
      budgetSliderValue={budgetSliderValue}
      budgetChoices={BUDGET_CHOICES}
      videoCardImage={VIDEO_CARD_IMAGE}
      setupError={setupError}
      onChooseBudget={chooseBudget}
      onBudgetSliderChange={handleBudgetSlider}
      onContinue={continueFromSetup}
      onOpenDemoVideo={() => setDemoVideoOpen(true)}
    />
  );

  const renderDemoInspector = () => (
    <SampleDemoInspector key="demo-inspector"
      motionProps={pageMotion(reduceMotion)}
      rooms={ROOMS}
      sampleRoomId={sampleRoomId}
      activeRoom={sampleRoom ?? ROOMS.living}
      demoColors={DEMO_COLORS}
      demoSpatialMath={DEMO_SPATIAL_MATH}
      items={items}
      scopeSelection={scopeSelection}
      color={color}
      split={split}
      masksVisible={demoMasksVisible}
      headingRef={demoHeadingRef}
      onAnimationComplete={focusDemoHeading}
      onSelectRoom={selectDemoRoom}
      onToggleMasks={() => setDemoMasksVisible((visible) => !visible)}
      onSelectColor={chooseWallColor}
      onSplit={setSplit}
      onReviewQuote={() => setScreen("estimate")}
    />
  );

  const renderCapture = () => (
    <RoomCapture key="capture"
      motionProps={pageMotion(reduceMotion)}
      mode={mode}
      captureMode={captureMode}
      videoAsset={videoAsset}
      videoFrames={videoFrames}
      photoAssets={photoAssets}
      audioNote={audioNote}
      cameraStream={cameraStream}
      liveVideoRef={liveVideoRef}
      recording={recording}
      recordingSeconds={recordingSeconds}
      preparingVideo={preparingVideo}
      audioRecording={audioRecording}
      audioRecordingSeconds={audioRecordingSeconds}
      cameraError={cameraError}
      captureError={captureError}
      photoError={photoError}
      audioError={audioError}
      scopeNote={scopeNote}
      analysisConsent={analysisConsent}
      captureIsReady={captureIsReady}
      analysisBusy={analysisBusy}
      onBackToBudget={() => setScreen("setup")}
      onCaptureModeChange={(nextMode) => {
        if (nextMode === "video") {
          setCaptureMode("video");
          setPhotoError("");
          setCaptureError("");
          setAnalysisConsent(false);
        } else {
          setCaptureMode("photos");
          stopCameraTracks();
          setCameraError("");
          setCaptureError("");
          setAnalysisConsent(false);
        }
      }}
      onStartVideoCapture={beginVideoCapture}
      onStopVideoCapture={stopVideoCapture}
      onRecordAgain={recordAgain}
      onClearVideoDraft={clearVideoDraft}
      onPhotoFiles={onPhotoFiles}
      onRemovePhoto={removePhoto}
      onStartAudioNote={startAudioNote}
      onStopAudioNote={stopAudioNote}
      onRemoveAudioNote={removeAudioNote}
      onScopeNoteChange={setScopeNote}
      onAnalysisConsentChange={setAnalysisConsent}
      onStartAnalysis={startAnalysis}
    />
  );

  const renderAnalysis = () => (
    <AnalysisProgress key="analysis"
      motionProps={pageMotion(reduceMotion)}
      mode={mode}
      captureMode={captureMode}
      primaryImageUrl={primaryImageUrl}
      primaryImageAlt={primaryImageAlt}
      sampleRoomName={sampleRoom?.name}
      reduceMotion={reduceMotion}
      analysisBusy={analysisBusy}
      currentAnalysisStep={currentAnalysisStep}
      analysisError={analysisError}
      analysisStatuses={analysisStatuses}
      maskUnavailable={maskUnavailable}
      onBackToCapture={() => setScreen("capture")}
    />
  );

  const areaReviewWallAreaDraftChange = (value: string) => {
    setWallAreaDraft(value);
    setWallAreaEditError("");
    setMeasurementError("");
  };

  const estimateWallAreaDraftChange = (value: string) => {
    setWallAreaDraft(value);
    setWallAreaEditError("");
  };

  const estimateEditorState: EstimateEditorState = {
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
  };

  const estimateEditorHandlers: EstimateEditorHandlers = {
    onScreenChange: setScreen,
    backFromEstimate,
    setDemoDimensions,
    startWallAreaEdit,
    saveWallAreaEdit,
    cancelWallAreaEdit,
    useCalculatedWallArea,
    onAreaReviewWallAreaDraftChange: areaReviewWallAreaDraftChange,
    onEstimateWallAreaDraftChange: estimateWallAreaDraftChange,
    continueFromAreaReview,
    chooseBudget,
    handleBudgetSlider,
    chooseWallColor,
    updateWallColorFromHex,
    fitBudget,
    toggleScope,
    toggleScopeFollowUps: () => setScopeFollowUpsOpen((open) => !open),
    updateDoorScopeSelection,
    updatePatchScopeSelection,
    updateMeasurement,
    setSplit,
    continueToContact,
    focusDemoHeading,
  };

  const contactSubmissionState: ContactSubmissionState = {
    mode,
    dimensions,
    measurementConfirmed,
    sampleRoomName: sampleRoom?.name ?? null,
    captureMode,
    primaryImageUrl,
    primaryImageAlt,
    videoAsset,
    photoAssets,
    totals,
    budgetStatus,
    budgetAmount,
    budgetIsCustom,
    budgetLabel,
    color,
    includedItems,
    name,
    phone,
    zipCode,
    mediaShareConsent,
    formError,
    submitting,
  };

  const contactSubmissionHandlers: ContactSubmissionHandlers = {
    setScreen,
    onNameChange: setName,
    onPhoneChange: setPhone,
    onZipCodeChange: setZipCode,
    onMediaShareConsentChange: setMediaShareConsent,
    onSubmitLead: submitLead,
    resetFlow: () => resetFlow(),
  };

  const renderMeasurements = () => (
    <EstimateEditor
      key="measurements"
      screen="measurements"
      motionProps={pageMotion(reduceMotion)}
      reduceMotion={reduceMotion}
      state={estimateEditorState}
      handlers={estimateEditorHandlers}
    />
  );

  const renderEstimate = () => (
    <EstimateEditor
      key="estimate"
      screen="estimate"
      motionProps={pageMotion(reduceMotion)}
      reduceMotion={reduceMotion}
      state={estimateEditorState}
      handlers={estimateEditorHandlers}
    />
  );

  const renderContact = () => (
    <ContactSubmission
      key="contact"
      screen="contact"
      motionProps={pageMotion(reduceMotion)}
      state={contactSubmissionState}
      handlers={contactSubmissionHandlers}
    />
  );

  const renderComplete = () => (
    <ContactSubmission
      key="complete"
      screen="complete"
      motionProps={pageMotion(reduceMotion)}
      state={contactSubmissionState}
      handlers={contactSubmissionHandlers}
    />
  );

  return (
    <div className={`wq-app min-h-screen ${compactMobileStep ? "max-sm:!bg-slate-50 max-sm:!bg-none" : ""}`}>
      <HeroHeader brandMark={BRAND_MARK} demo={mode === "demo"} compact={compactMobileStep} landing={screen === "setup"} />
      <main className={`wq-main pt-5 sm:pt-8 ${compactMobileStep || screen === "setup" ? "max-sm:pt-3" : ""} ${mode === "homeowner" && screen === "estimate" ? "wq-estimate-bar-clearance" : ""}`}>
        {screen === "setup" && mode === "homeowner" ? null : <ExperienceModeSwitch mode={mode} disabled={modeSwitchDisabled} onSelect={(nextMode) => { if (nextMode !== mode) resetFlow(nextMode); }} />}
        <JourneyProgress active={activeJourneyStep} demo={mode === "demo"} />
        <AnimatePresence mode="wait">
          {screen === "setup" && renderSetup()}
          {screen === "demo-inspector" && renderDemoInspector()}
          {screen === "capture" && renderCapture()}
          {screen === "analysis" && renderAnalysis()}
          {screen === "measurements" && renderMeasurements()}
          {screen === "estimate" && renderEstimate()}
          {screen === "contact" && renderContact()}
          {screen === "complete" && renderComplete()}
        </AnimatePresence>
        <div className={compactMobileStep ? "max-sm:hidden" : ""}><PageFooter /></div>
      </main>
      <EstimateMobileSummary
        mode={mode}
        screen={screen}
        dimensions={dimensions}
        measurementConfirmed={measurementConfirmed}
        totals={totals}
        budgetStatus={budgetStatus}
        onContinueToContact={continueToContact}
      />
      <Dialog open={demoVideoOpen} onOpenChange={setDemoVideoOpen}>
        <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] max-w-4xl overflow-y-auto rounded-[1.5rem] border-slate-700 bg-slate-950 p-0 text-white sm:w-[calc(100%-2rem)] sm:rounded-3xl [&>button]:right-3 [&>button]:top-3 [&>button]:grid [&>button]:min-h-11 [&>button]:min-w-11 [&>button]:place-items-center [&>button]:rounded-xl [&>button]:bg-white/10 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/20">
          <div className="p-5 sm:p-8">
            <DialogHeader className="pr-12">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">WalkQuote · three-minute product tour</p>
              <DialogTitle className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl">{DEMO_VIDEO ? "WalkQuote in three minutes" : "The video is coming soon."}</DialogTitle>
              <DialogDescription className="mt-2 text-base leading-6 text-slate-300">{DEMO_VIDEO ? "See how room details, scope review and a preliminary budget match fit together." : "We have not added a video clip yet. The still image on the landing page is a sample room, not a recording."}</DialogDescription>
            </DialogHeader>
            <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
              {DEMO_VIDEO?.kind === "video" ? (
                <video src={DEMO_VIDEO.src} controls playsInline preload="metadata" className="h-full w-full bg-black" aria-label="Three-minute WalkQuote product demonstration" />
              ) : DEMO_VIDEO?.kind === "embed" ? (
                <iframe src={DEMO_VIDEO.src} title="Three-minute WalkQuote product demonstration" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen; picture-in-picture" allowFullScreen className="h-full w-full border-0" />
              ) : (
                <div role="status" aria-live="polite" className="flex h-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.14),transparent_62%)] px-5 text-center sm:px-10">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-teal-300/30 bg-teal-300/10 text-teal-200"><Video size={26} aria-hidden="true" /></span>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Video coming soon</p>
                  <p className="mt-2 max-w-md text-lg font-semibold leading-6 text-white">The three-minute walkthrough has not been added yet.</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">This frame is intentionally empty until a real YouTube, Loom, or MP4 source is added.</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-5 text-slate-300">Explore the sample now. It opens without sign-in and creates no room request.</p>
              <Link to="/?experience=demo" onClick={() => setDemoVideoOpen(false)} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-base font-bold text-slate-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Explore the Interactive Demo <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

