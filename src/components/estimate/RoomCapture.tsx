import type { ChangeEvent, RefObject } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  CircleAlert,
  FileImage,
  Info,
  Loader2,
  Mic,
  RefreshCw,
  ShieldCheck,
  Timer,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { MIN_ROOM_PHOTOS } from "@/lib/room-media";
import type { RoomImageAsset } from "@/lib/room-media";
import type {
  CapturedAudioAsset,
  CapturedVideoAsset,
  CaptureMode,
  RoomFrame,
} from "@/types/estimate";

interface RoomCaptureProps {
  motionProps: HTMLMotionProps<"section">;
  mode: "homeowner" | "demo";
  captureMode: CaptureMode;
  videoAsset: CapturedVideoAsset | null;
  videoFrames: RoomFrame[];
  photoAssets: RoomImageAsset[];
  audioNote: CapturedAudioAsset | null;
  cameraStream: MediaStream | null;
  liveVideoRef: RefObject<HTMLVideoElement | null>;
  recording: boolean;
  recordingSeconds: number;
  preparingVideo: boolean;
  audioRecording: boolean;
  audioRecordingSeconds: number;
  cameraError: string;
  captureError: string;
  photoError: string;
  audioError: string;
  scopeNote: string;
  analysisConsent: boolean;
  captureIsReady: boolean;
  analysisBusy: boolean;
  onBackToBudget: () => void;
  onCaptureModeChange: (mode: CaptureMode) => void;
  onStartVideoCapture: () => void | Promise<void>;
  onStopVideoCapture: () => void;
  onRecordAgain: () => void | Promise<void>;
  onClearVideoDraft: () => void;
  onPhotoFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onVideoFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onUseSampleVideo?: () => void | Promise<void>;
  onRemovePhoto: (id: string) => void;
  onStartAudioNote: () => void | Promise<void>;
  onStopAudioNote: () => void;
  onRemoveAudioNote: () => void;
  onScopeNoteChange: (value: string) => void;
  onAnalysisConsentChange: (checked: boolean) => void;
  onStartAnalysis: () => void | Promise<void>;
}

function clockTime(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RoomCapture({
  motionProps,
  mode,
  captureMode,
  videoAsset,
  videoFrames,
  photoAssets,
  audioNote,
  cameraStream,
  liveVideoRef,
  recording,
  recordingSeconds,
  preparingVideo,
  audioRecording,
  audioRecordingSeconds,
  cameraError,
  captureError,
  photoError,
  audioError,
  scopeNote,
  analysisConsent,
  captureIsReady,
  analysisBusy,
  onBackToBudget,
  onCaptureModeChange,
  onStartVideoCapture,
  onStopVideoCapture,
  onRecordAgain,
  onClearVideoDraft,
  onPhotoFiles,
  onVideoFile,
  onUseSampleVideo,
  onRemovePhoto,
  onStartAudioNote,
  onStopAudioNote,
  onRemoveAudioNote,
  onScopeNoteChange,
  onAnalysisConsentChange,
  onStartAnalysis,
}: RoomCaptureProps) {
  return (
    <motion.section key="capture" className="space-y-6 max-sm:space-y-4" {...motionProps}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={onBackToBudget} className="mb-3 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-slate-700 hover:text-slate-950"><ArrowLeft size={17} /><span className="sm:hidden">Back</span><span className="hidden sm:inline">Back to budget</span></button>
          <p className="max-sm:hidden text-xs font-bold uppercase tracking-[0.16em] text-teal-800">02 · Capture your room</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"><span className="sm:hidden">{captureMode === "video" ? "Record a room tour." : "Add room photos."}</span><span className="hidden sm:inline">Show the room as you describe it.</span></h1>
          <p className="mt-2 max-w-2xl text-base leading-6 text-slate-600 sm:leading-7"><span className="sm:hidden">{captureMode === "video" ? "Walk slowly. Describe the paint or repairs." : "Take 3–4 clear views of the room."}</span><span className="hidden sm:inline">A slow video tour is the quickest route. Three or four photos work when video is not convenient.</span></p>
        </div>
        <span className="max-sm:hidden inline-flex items-center gap-2 self-start rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"><Timer size={16} /> About 30 seconds · up to 60</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
        <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div><p className="text-base font-bold text-slate-800 sm:text-xs sm:uppercase sm:tracking-[0.14em] sm:text-slate-500"><span className="sm:hidden">Choose video or photos</span><span className="hidden sm:inline">Capture method</span></p><p className="mt-1 hidden text-sm text-slate-600 sm:block">Use video first, or choose three or four photos.</p></div>
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Capture method">
              <button type="button" role="tab" aria-selected={captureMode === "video"} disabled={recording || preparingVideo} onClick={() => onCaptureModeChange("video")} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${captureMode === "video" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}><Video size={16} /> Video</button>
              <button type="button" role="tab" aria-selected={captureMode === "photos"} disabled={recording || preparingVideo} onClick={() => onCaptureModeChange("photos")} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${captureMode === "photos" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}><FileImage size={16} /> Photos</button>
            </div>
          </div>

          {captureMode === "video" ? (
            <div className="space-y-5 p-4 sm:p-6">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 sm:aspect-video sm:bg-slate-950">
                {cameraStream ? (
                  <video ref={liveVideoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-contain" aria-label="Live camera view of the room" />
                ) : videoAsset ? (
                  <video src={videoAsset.previewUrl} controls playsInline className="absolute inset-0 h-full w-full object-contain" aria-label="Recorded room walkthrough preview with audio" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center p-6 text-center">
                    <div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-slate-300 bg-white text-slate-700 shadow-sm"><Camera size={26} /></span><p className="mt-3 text-base font-semibold text-slate-900 sm:text-slate-200">Room preview</p></div>
                  </div>
                )}
                {(recording || videoAsset || cameraStream) && <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
                  <span className="rounded-full bg-slate-950/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white">{recording ? "Recording" : videoAsset ? "Preview ready" : "Camera ready"}</span>
                  {(recording || videoAsset) && <span className="rounded-full bg-slate-950/80 px-3 py-1.5 text-sm font-semibold tabular-nums text-white">{clockTime(recordingSeconds)}{recording ? " / 01:00" : ""}</span>}
                </div>}
                {recording && <div className="pointer-events-none absolute inset-x-3 bottom-3 hidden items-center gap-2 rounded-xl bg-slate-950/85 px-3 py-2 text-sm font-semibold text-white sm:flex"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />Walk slowly. Describe the work you want done.</div>}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {!recording && !videoAsset && (
                  <button type="button" data-testid="start-walkthrough-recording-btn" onClick={() => void onStartVideoCapture()} disabled={preparingVideo} className="inline-flex min-h-14 w-full flex-1 items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-base font-bold text-white transition hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60"><Camera size={18} /> Start walkthrough</button>
                )}
                {!recording && !cameraStream && (!videoAsset || !preparingVideo) && (
                  <label data-testid="upload-video-btn" className="inline-flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 transition hover:border-slate-500 hover:bg-slate-50 focus-within:outline focus-within:outline-2 focus-within:outline-teal-700">
                    <Upload size={18} />
                    <span>{videoAsset ? "Upload a different video" : "Upload recorded video"}</span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={onVideoFile}
                      disabled={preparingVideo}
                      className="sr-only"
                      data-testid="upload-video-input"
                      aria-label="Upload a recorded room walkthrough video"
                    />
                  </label>
                )}
                {!recording && !cameraStream && !videoAsset && onUseSampleVideo && (
                  <button type="button" data-testid="use-sample-video-btn" onClick={() => void onUseSampleVideo()} disabled={preparingVideo} className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-teal-700 bg-teal-50 px-4 py-3 text-base font-semibold text-teal-900 transition hover:bg-teal-100 disabled:cursor-wait disabled:opacity-60">{preparingVideo ? <><Loader2 size={17} className="animate-spin" /> Preparing sample</> : <><Video size={18} /> Use sample video for quick test</>}</button>
                )}
                {recording && (
                  <button type="button" onClick={onStopVideoCapture} className="inline-flex min-h-14 w-full flex-1 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-3 text-base font-bold text-white transition hover:bg-rose-800"><span className="h-3 w-3 rounded-sm bg-white" /> Stop and preview</button>
                )}
                {videoAsset && !recording && (
                  <button type="button" onClick={() => void onRecordAgain()} disabled={preparingVideo} className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 transition hover:border-slate-500 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">{preparingVideo ? <><Loader2 size={17} className="animate-spin" /> Preparing video</> : <><RefreshCw size={17} /> Record again</>}</button>
                )}
                {videoAsset && !recording && (
                  <button type="button" onClick={onClearVideoDraft} disabled={preparingVideo} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 size={17} /> Delete</button>
                )}
              </div>
              {cameraError && <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="alert"><CircleAlert size={17} className="mt-0.5 shrink-0" />{cameraError}</p>}
              {preparingVideo ? (
                <div className="max-sm:hidden flex items-center gap-2 rounded-xl bg-slate-100 p-3 text-base font-medium text-slate-800" role="status">
                  <Loader2 size={17} className="animate-spin" /> Preparing video and review frames
                </div>
              ) : videoAsset && videoFrames.length === 4 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-3 text-base font-medium text-emerald-900" role="status">
                  <CheckCircle2 size={17} /> Video ready{Number.isFinite(videoAsset.durationSeconds) ? ` · ${Math.round(videoAsset.durationSeconds)} seconds` : ""} · 4 review frames
                </div>
              ) : null}
              <div className="max-sm:hidden rounded-2xl border border-teal-200 bg-teal-50 p-4 sm:p-5">
                <p className="flex items-center gap-2 font-semibold text-teal-950"><Info size={17} /> Pan slowly across all four walls.</p>
                <p className="mt-2 text-sm leading-6 text-teal-950">Begin with a wide view. Hold briefly on doors, windows, trim, and any surface marks. Describe the paint and work you want. Keep your name, phone number, and address out of the recording.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-sm:hidden"><p className="text-lg font-semibold text-slate-950">Add 3 or 4 room photos.</p><p className="mt-1 text-sm leading-6 text-slate-600">Show the walls, doors, windows, and any marks.</p></div>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-base font-bold text-white transition hover:bg-teal-900 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal-700">
                    <Camera size={18} /> Take Photo
                    <input type="file" accept="image/*" capture="environment" onChange={onPhotoFiles} className="sr-only" aria-label="Take a room photo with the rear camera" />
                  </label>
                  <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-bold text-slate-800 transition hover:border-slate-500 hover:bg-slate-50 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal-700">
                    <Upload size={18} /> Choose from library
                    <input type="file" accept="image/*" multiple onChange={onPhotoFiles} className="sr-only" aria-label="Choose three or four room photos from your library" />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-4">
                {photoAssets.map((photo, index) => (
                  <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    <img src={photo.previewUrl} alt={`Room photo ${index + 1}`} className="block h-auto w-full object-contain" />
                    <span className="absolute bottom-2 left-2 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-white">Angle {index + 1}</span>
                    <button type="button" onClick={() => onRemovePhoto(photo.id)} aria-label={`Remove room photo ${index + 1}`} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white text-slate-900 shadow-md transition hover:bg-rose-50 hover:text-rose-800"><X size={16} /></button>
                  </div>
                ))}
                {photoAssets.length < MIN_ROOM_PHOTOS && Array.from({ length: MIN_ROOM_PHOTOS - photoAssets.length }, (_, index) => (
                  <div key={`empty-${index}`} className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center text-sm font-medium text-slate-500"><span><FileImage size={23} className="mx-auto mb-2" />Angle {photoAssets.length + index + 1}</span></div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{photoAssets.length} of 3–4 photos selected</span><span className="max-sm:hidden text-slate-500">Each image is prepared on this device.</span></div>
              {photoError && <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-900" role="alert"><CircleAlert size={17} className="mt-0.5 shrink-0" />{photoError}</p>}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-xl"><p className="flex items-center gap-2 font-semibold text-slate-950"><Mic size={17} className="text-teal-800" /> Add a room note <span className="font-normal text-slate-500">(optional)</span></p><p className="mt-1 text-sm leading-6 text-slate-600"><span className="sm:hidden">What should be painted or repaired?</span><span className="hidden sm:inline">Describe the paint, surface work, and color change. Leave contact details out of your note.</span></p></div>
                  <div className="flex gap-2">
                    {!audioRecording && !audioNote && <button type="button" onClick={() => void onStartAudioNote()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"><Mic size={16} /> Record note</button>}
                    {audioRecording && <button type="button" onClick={onStopAudioNote} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800">Stop note · {clockTime(audioRecordingSeconds)}</button>}
                    {audioNote && <button type="button" onClick={onRemoveAudioNote} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-800"><Trash2 size={15} /> Remove note</button>}
                  </div>
                </div>
                {audioNote && <div className="mt-4 rounded-xl bg-white p-3"><audio controls src={audioNote.previewUrl} className="w-full" aria-label="Recorded room scope note" /><p className="mt-2 text-sm text-emerald-800">Voice note ready</p></div>}
                {audioError && <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-amber-900" role="alert"><CircleAlert size={16} className="mt-0.5 shrink-0" />{audioError}</p>}
                <label className="mt-4 block text-sm font-semibold text-slate-800" htmlFor="photo-scope-note"><span className="sm:hidden">Type a room note</span><span className="hidden sm:inline">Or type the work you want done</span></label>
                <textarea id="photo-scope-note" maxLength={600} value={scopeNote} onChange={(event) => onScopeNoteChange(event.target.value)} placeholder="Example: Paint the walls warm off-white, repair one small dent, and leave the ceiling as it is." className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base leading-6 text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20" />
                <p className="mt-2 text-xs leading-5 text-slate-500"><span className="sm:hidden">Voice notes are transcribed. Leave contact details out of your note.</span><span className="hidden sm:inline">Voice audio is sent for transcription. WalkQuote redacts common email, phone, ZIP, and street-address patterns from the transcript before image analysis and storage.</span></p>
              </div>
            </div>
          )}
        </div>

        <aside className="hidden space-y-5 sm:block">
          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">How to get a useful estimate</p>
            <ol className="mt-5 space-y-4">
              {[
                ["01", "Show the whole room", "Move slowly so each wall and opening is visible."],
                ["02", "Name the work", "Describe paint, trim, ceilings, and minor surface repairs."],
                ["03", "Review supported quantities", "WalkQuote uses doorway scale when available, or asks you to enter net wall area. You can correct wall area in the quote."],
              ].map(([number, title, detail]) => <li key={number} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold tabular-nums text-slate-700">{number}</span><div><strong className="text-base text-slate-900">{title}</strong><p className="mt-0.5 text-sm leading-5 text-slate-600">{detail}</p></div></li>)}
            </ol>
          </div>
          <div className="rounded-[1.8rem] border border-slate-200 bg-slate-950 p-5 text-white sm:p-6">
            <div className="flex items-center gap-2 text-teal-300"><ShieldCheck size={18} /><span className="text-xs font-bold uppercase tracking-[0.14em]">Media handling</span></div>
            <p className="mt-3 text-base leading-7 text-slate-200">Selected frames or photos and your spoken or typed room note are analyzed. For a video, four selected frames go to visual analysis and its recorded audio goes to transcription; the full video is not sent to the image-analysis model. Your original video, including its audio, photos, and any separate spoken note stay in this browser until you send the contractor request and accept the separate sharing consent.</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">Contact details are collected later and kept out of model prompts.</p>
          </div>
        </aside>
      </div>

      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 sm:p-5">
        <label className="flex cursor-pointer items-start gap-3 text-base leading-6 text-teal-950">
          <input type="checkbox" checked={analysisConsent} onChange={(event) => onAnalysisConsentChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-teal-800" />
          <span>
            {captureMode === "video" ? (
              <><strong>I agree to send four selected video frames and any room note to Meta for analysis.</strong> The video’s audio goes to Meta for transcription; the full video is not used for visual analysis. If I submit the estimate, the original video and audio are stored with my request and shared with Demo Painting Co. only after my separate consent. I will keep my name, phone, and address out of the recording and note.</>
            ) : (
              <><strong>I agree to send my selected photos and any typed or transcribed room note to Meta for analysis.</strong> Any voice-note audio goes to Meta for transcription. If I submit the estimate, my photos and any separate voice note are stored with the request and shared with Demo Painting Co. only after my separate consent. I will keep my name, phone, and address out of my note.</>
            )}
          </span>
        </label>
      </div>
      {captureError && <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-900" role="alert"><CircleAlert size={17} className="mt-0.5 shrink-0" />{captureError}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-sm:hidden text-sm leading-6 text-slate-600">{captureMode === "video" ? videoAsset ? "Video and four compressed frames are ready." : "Record about 30 seconds (stops at 60), or upload a video up to 3 minutes and 120MB." : photoAssets.length >= MIN_ROOM_PHOTOS ? "Your selected angles are ready for analysis." : "Select three or four photos to continue."}</p>
        <p className="hidden max-sm:block text-base font-medium leading-5 text-slate-700" role="status">{captureMode === "video" ? preparingVideo ? "Preparing video…" : videoAsset ? videoFrames.length === 4 ? "Video ready." : "Try recording again or add photos." : "Record a room tour to continue." : photoAssets.length >= MIN_ROOM_PHOTOS ? "Photos ready." : `Add ${Math.max(0, MIN_ROOM_PHOTOS - photoAssets.length)} more photo${MIN_ROOM_PHOTOS - photoAssets.length === 1 ? "" : "s"}.`}</p>
        <button type="button" onClick={() => void onStartAnalysis()} disabled={!captureIsReady || analysisBusy || (mode === "homeowner" && !analysisConsent)} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-teal-800 px-6 py-4 text-base font-bold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none">Analyze room <ArrowRight size={18} /></button>
      </div>
    </motion.section>
  );
}
