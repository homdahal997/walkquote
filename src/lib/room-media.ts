export const MAX_CAPTURED_VIDEO_SECONDS = 60;
export const TARGET_CAPTURED_VIDEO_SECONDS = 30;
export const MAX_VIDEO_CAPTURE_BYTES = 2_300_000;
export const MAX_UPLOADED_VIDEO_BYTES = 120_000_000;
export const MAX_UPLOADED_VIDEO_SECONDS = 180;

const VIDEO_CAPTURE_MAX_DIMENSION = 720;
const VIDEO_CAPTURE_FRAME_RATE = 12;
const VIDEO_CAPTURE_VIDEO_BITS_PER_SECOND = 160_000;
const VIDEO_CAPTURE_AUDIO_BITS_PER_SECOND = 32_000;
export const MIN_ROOM_PHOTOS = 3;
export const MAX_ROOM_PHOTOS = 4;
export const MAX_COMPRESSED_PHOTO_BYTES = 600_000;
export const MAX_ANALYSIS_FRAME_BYTES = 280_000;
export const MAX_AUDIO_NOTE_BYTES = 750_000;

export interface RoomImageAsset {
  id: string;
  blob: Blob;
  previewUrl: string;
  mimeType: "image/jpeg";
  size: number;
  name: string;
}

export interface RoomFrame extends RoomImageAsset {
  timestampSeconds?: number;
}

export interface WalkthroughRecording {
  videoBlob: Blob;
  audioBlob: Blob;
  mimeType: string;
  durationSeconds: number;
}

export interface RecordingSession<T> {
  result: Promise<T>;
  stop: () => void;
}

function supportedMimeType(candidates: string[]) {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return candidates.find((candidate) => {
    try {
      return MediaRecorder.isTypeSupported(candidate);
    } catch {
      return false;
    }
  }) ?? "";
}

function createRecorder(stream: MediaStream, candidates: string[], options: MediaRecorderOptions = {}) {
  if (typeof MediaRecorder === "undefined") throw new Error("recording-unavailable");
  const mimeType = supportedMimeType(candidates);
  if (mimeType) {
    try {
      return new MediaRecorder(stream, { ...options, mimeType });
    } catch {
      // Some WebKit versions report a type as supported but reject it for a live stream.
    }
  }
  try {
    return new MediaRecorder(stream, options);
  } catch {
    try {
      return new MediaRecorder(stream);
    } catch {
      throw new Error("recording-unavailable");
    }
  }
}

async function inferRecorderMimeType(blob: Blob, typeFallback: string) {
  try {
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const isWebm = header.length >= 4 && header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
    const isMp4 = header.length >= 8 && String.fromCharCode(...header.subarray(4, 8)) === "ftyp";
    const family = typeFallback.startsWith("audio/") ? "audio" : "video";
    if (isWebm) return `${family}/webm`;
    if (isMp4) return `${family}/mp4`;
  } catch {
    // Fall through to the browser's supported default for this recorder.
  }
  return typeFallback;
}

function waitForRecorderBlob(
  recorder: MediaRecorder,
  chunks: BlobPart[],
  typeFallback: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let chunkMimeType = "";
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
        if (!chunkMimeType && event.data.type) chunkMimeType = event.data.type;
      }
    };
    recorder.onerror = () => reject(new Error("recording-failed"));
    recorder.onstop = () => {
      const rawBlob = new Blob(chunks);
      if (!rawBlob.size) {
        reject(new Error("recording-empty"));
        return;
      }
      void (async () => {
        const mimeType = recorder.mimeType || chunkMimeType || rawBlob.type || await inferRecorderMimeType(rawBlob, typeFallback);
        resolve(new Blob(chunks, { type: mimeType || typeFallback }));
      })().catch(reject);
    };
  });
}

interface PreparedVideoCaptureStream {
  stream: MediaStream;
  cleanup: () => void;
}

function prepareVideoCaptureStream(source: MediaStream, previewVideo?: HTMLVideoElement): PreparedVideoCaptureStream {
  const nativeStream = { stream: source, cleanup: () => undefined };
  const cameraTrack = source.getVideoTracks()[0];
  if (!cameraTrack || typeof document === "undefined") return nativeStream;

  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_CAPTURE_MAX_DIMENSION;
  canvas.height = Math.round(VIDEO_CAPTURE_MAX_DIMENSION * 9 / 16);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context || typeof canvas.captureStream !== "function") return nativeStream;

  const sourceVideo = previewVideo ?? document.createElement("video");
  const ownsVideo = !previewVideo;
  let canvasStream: MediaStream | null = null;
  try {
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;
    if (ownsVideo) sourceVideo.autoplay = true;
    if (sourceVideo.srcObject !== source) {
      sourceVideo.srcObject = ownsVideo ? new MediaStream([cameraTrack]) : source;
    }

    canvasStream = canvas.captureStream(VIDEO_CAPTURE_FRAME_RATE);
    const canvasVideoTrack = canvasStream.getVideoTracks()[0];
    if (!canvasVideoTrack) throw new Error("compressed-video-track-unavailable");
    const captureStream = new MediaStream([canvasVideoTrack, ...source.getAudioTracks()]);
    let disposed = false;
    let frameRequest = 0;
    let lastFrameAt = 0;
    const frameInterval = 1_000 / VIDEO_CAPTURE_FRAME_RATE;
    const drawFrame = (timestamp: number) => {
      if (disposed) return;
      if (
        timestamp - lastFrameAt >= frameInterval &&
        sourceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        sourceVideo.videoWidth > 0 && sourceVideo.videoHeight > 0
      ) {
        const scale = Math.min(1, VIDEO_CAPTURE_MAX_DIMENSION / Math.max(sourceVideo.videoWidth, sourceVideo.videoHeight));
        const width = Math.max(2, Math.round(sourceVideo.videoWidth * scale / 2) * 2);
        const height = Math.max(2, Math.round(sourceVideo.videoHeight * scale / 2) * 2);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        context.fillStyle = "#101820";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
        lastFrameAt = timestamp;
      }
      frameRequest = window.requestAnimationFrame(drawFrame);
    };

    if (sourceVideo.paused) void sourceVideo.play().catch(() => undefined);
    frameRequest = window.requestAnimationFrame(drawFrame);

    return {
      stream: captureStream,
      cleanup: () => {
        disposed = true;
        if (frameRequest) window.cancelAnimationFrame(frameRequest);
        canvasStream?.getTracks().forEach((track) => track.stop());
        if (ownsVideo) {
          sourceVideo.pause();
          sourceVideo.srcObject = null;
        }
      },
    };
  } catch {
    canvasStream?.getTracks().forEach((track) => track.stop());
    if (ownsVideo) {
      sourceVideo.pause();
      sourceVideo.srcObject = null;
    }
    return nativeStream;
  }
}

export function beginVideoWalkthrough(stream: MediaStream, previewVideo?: HTMLVideoElement): RecordingSession<WalkthroughRecording> {
  if (typeof MediaRecorder === "undefined") throw new Error("recording-unavailable");
  if (!stream.getVideoTracks().length || !stream.getAudioTracks().length) {
    throw new Error("camera-and-microphone-required");
  }

  let preparedStream = prepareVideoCaptureStream(stream, previewVideo);
  let videoRecorder: MediaRecorder;
  const videoTypes = [
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
  ];
  try {
    videoRecorder = createRecorder(preparedStream.stream, videoTypes, {
      videoBitsPerSecond: VIDEO_CAPTURE_VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: VIDEO_CAPTURE_AUDIO_BITS_PER_SECOND,
    });
  } catch (error) {
    if (preparedStream.stream === stream) throw error;
    preparedStream.cleanup();
    preparedStream = { stream, cleanup: () => undefined };
    videoRecorder = createRecorder(stream, videoTypes, {
      videoBitsPerSecond: VIDEO_CAPTURE_VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: VIDEO_CAPTURE_AUDIO_BITS_PER_SECOND,
    });
  }

  const audioStream = new MediaStream(stream.getAudioTracks());
  let audioRecorder: MediaRecorder;
  try {
    audioRecorder = createRecorder(
      audioStream,
      ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"],
      { audioBitsPerSecond: VIDEO_CAPTURE_AUDIO_BITS_PER_SECOND },
    );
  } catch (error) {
    preparedStream.cleanup();
    throw error;
  }

  const videoChunks: BlobPart[] = [];
  const audioChunks: BlobPart[] = [];
  const startedAt = performance.now();
  let stoppedAt: number | null = null;
  let durationLimitTimer: number | null = null;
  const videoResult = waitForRecorderBlob(videoRecorder, videoChunks, "video/webm");
  const audioResult = waitForRecorderBlob(audioRecorder, audioChunks, "audio/webm");
  const stop = () => {
    if (stoppedAt === null) stoppedAt = performance.now();
    if (durationLimitTimer !== null) window.clearTimeout(durationLimitTimer);
    durationLimitTimer = null;
    if (videoRecorder.state !== "inactive") videoRecorder.stop();
    if (audioRecorder.state !== "inactive") audioRecorder.stop();
  };

  try {
    videoRecorder.start(250);
    audioRecorder.start(250);
    durationLimitTimer = window.setTimeout(stop, MAX_CAPTURED_VIDEO_SECONDS * 1_000);
  } catch (error) {
    stop();
    preparedStream.cleanup();
    void videoResult.catch(() => undefined);
    void audioResult.catch(() => undefined);
    throw error;
  }

  const result = Promise.all([videoResult, audioResult]).then(([videoBlob, audioBlob]) => ({
    videoBlob,
    audioBlob,
    mimeType: videoBlob.type || videoRecorder.mimeType || "video/webm",
    durationSeconds: Math.min(
      MAX_CAPTURED_VIDEO_SECONDS,
      Math.max(0, ((stoppedAt ?? performance.now()) - startedAt) / 1_000),
    ),
  })).catch((error) => {
    stop();
    throw error;
  }).finally(() => {
    if (durationLimitTimer !== null) window.clearTimeout(durationLimitTimer);
    durationLimitTimer = null;
    preparedStream.cleanup();
  });

  return { result, stop };
}

function encodeWav(chunks: Float32Array[], inputRate: number): Blob {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const mono = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) { mono.set(c, offset); offset += c.length; }
  const outputRate = 24_000;
  const ratio = inputRate / outputRate;
  const outLength = Math.max(1, Math.floor(total / ratio));
  const buffer = new ArrayBuffer(44 + outLength * 2);
  const view = new DataView(buffer);
  const text = (o: number, s: string) => { for (let i = 0; i < s.length; i += 1) view.setUint8(o + i, s.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, 36 + outLength * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, outputRate, true); view.setUint32(28, outputRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, outLength * 2, true);
  for (let i = 0; i < outLength; i += 1) {
    const s = Math.max(-1, Math.min(1, mono[Math.min(total - 1, Math.floor(i * ratio))] ?? 0));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Records the microphone straight to 24 kHz mono WAV via Web Audio, so no decoding is needed later (works on iOS Safari). */
function beginPcmCapture(stream: MediaStream): RecordingSession<Blob> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor: typeof AudioContext | undefined = (window as any).AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  const context = new Ctor();
  if (typeof context.createScriptProcessor !== "function") { void context.close(); return null; }
  void context.resume().catch(() => undefined);
  const source = context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  const processor = context.createScriptProcessor(4096, 1, 1);
  const sink = context.createGain();
  sink.gain.value = 0;
  const chunks: Float32Array[] = [];
  let stopped = false;
  // Cap at 15 s so the 24 kHz WAV stays under the note size limit.
  let samples = 0;
  const maxSamples = context.sampleRate * 15;
  processor.onaudioprocess = (event) => {
    if (stopped) return;
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    samples += event.inputBuffer.length;
    if (samples >= maxSamples) session.stop();
  };
  source.connect(processor); processor.connect(sink); sink.connect(context.destination);
  let resolveBlob: (b: Blob) => void = () => undefined;
  let rejectBlob: (e: Error) => void = () => undefined;
  const result = new Promise<Blob>((res, rej) => { resolveBlob = res; rejectBlob = rej; });
  const session = {
    result,
    stop: () => {
      if (stopped) return;
      stopped = true;
      const rate = context.sampleRate;
      try { source.disconnect(); processor.disconnect(); sink.disconnect(); } catch { /* already disconnected */ }
      void context.close().catch(() => undefined);
      if (!chunks.length) { rejectBlob(new Error("recording-empty")); return; }
      resolveBlob(encodeWav(chunks, rate));
    },
  };
  return session;
}

export function beginAudioNoteCapture(stream: MediaStream): RecordingSession<Blob> {
  if (!stream.getAudioTracks().length) throw new Error("microphone-required");
  try {
    const pcm = beginPcmCapture(stream);
    if (pcm) return pcm;
  } catch {
    // Fall back to MediaRecorder below.
  }
  if (typeof MediaRecorder === "undefined") throw new Error("recording-unavailable");
  const audioStream = new MediaStream(stream.getAudioTracks());
  const recorder = createRecorder(
    audioStream,
    ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"],
    { audioBitsPerSecond: 40_000 },
  );
  const chunks: BlobPart[] = [];
  const result = waitForRecorderBlob(recorder, chunks, "audio/webm");
  recorder.start(250);
  return {
    result,
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
    },
  };
}

export async function compressRoomPhoto(file: File): Promise<RoomImageAsset> {
  if (!file.type.startsWith("image/") || file.size === 0 || file.size > 24_000_000) {
    throw new Error("photo-format-or-size-invalid");
  }
  if (typeof createImageBitmap !== "function") throw new Error("photo-preview-unavailable");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("photo-could-not-open");
  }

  try {
    const blob = await encodeAnalysisJpeg(bitmap, bitmap.width, bitmap.height, PHOTO_TARGET_BYTES);
    if (!blob) throw new Error("photo-too-large-after-compression");
    return {
      id: crypto.randomUUID(),
      blob,
      previewUrl: URL.createObjectURL(blob),
      mimeType: "image/jpeg",
      size: blob.size,
      name: file.name || "room-photo.jpg",
    };
  } finally {
    bitmap.close();
  }
}

function canvasJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Analysis images: longest side at most 1280px, JPEG 0.82 first, then smaller until under budget. */
export const ANALYSIS_MAX_DIMENSION = 1_280;
export const ANALYSIS_JPEG_QUALITY = 0.82;
export const PHOTO_TARGET_BYTES = 360_000;
export const FRAME_TARGET_BYTES = 240_000;

export function fitWithin(width: number, height: number, maxDimension = ANALYSIS_MAX_DIMENSION) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function encodeAnalysisJpeg(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, maxBytes: number) {
  if (!sourceWidth || !sourceHeight) throw new Error("image-dimensions-invalid");
  let { width, height } = fitWithin(sourceWidth, sourceHeight);
  let quality = ANALYSIS_JPEG_QUALITY;
  const canvas = document.createElement("canvas");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("image-compression-unavailable");
    context.drawImage(source, 0, 0, width, height);
    const blob = await canvasJpeg(canvas, quality);
    if (!blob) throw new Error("image-compression-unavailable");
    if (blob.size <= maxBytes) return blob;
    if (quality > 0.66) quality = Math.round((quality - 0.08) * 100) / 100;
    else {
      ({ width, height } = fitWithin(width, height, Math.max(480, Math.round(Math.max(width, height) * 0.82))));
      quality = 0.74;
    }
  }
  return null;
}

export interface KeyframeCandidate {
  timestampSeconds: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  signature: number[];
}

function measureFrame(video: HTMLVideoElement): Omit<KeyframeCandidate, "timestampSeconds"> {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 48;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !video.videoWidth) return { brightness: 0, contrast: 0, sharpness: 0, signature: [] };
  context.drawImage(video, 0, 0, 64, 48);
  const { data } = context.getImageData(0, 0, 64, 48);
  const luma = new Float32Array(64 * 48);
  for (let i = 0; i < luma.length; i += 1) luma[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  let sum = 0;
  for (const value of luma) sum += value;
  const brightness = sum / luma.length;
  let variance = 0;
  let edges = 0;
  for (let y = 0; y < 48; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const value = luma[y * 64 + x];
      variance += (value - brightness) ** 2;
      if (x > 0) edges += Math.abs(value - luma[y * 64 + x - 1]);
      if (y > 0) edges += Math.abs(value - luma[(y - 1) * 64 + x]);
    }
  }
  const signature = Array.from({ length: 8 }, (_, band) => {
    let bandSum = 0;
    for (let y = 0; y < 48; y += 1) for (let x = band * 8; x < band * 8 + 8; x += 1) bandSum += luma[y * 64 + x];
    return bandSum / (8 * 48) - brightness;
  });
  return { brightness, contrast: Math.sqrt(variance / luma.length), sharpness: edges / luma.length, signature };
}

/** Keeps lit, non-blurry frames and picks the sharpest, most different one from each part of the walk. */
export function selectDistinctKeyframes(candidates: KeyframeCandidate[], count: number): KeyframeCandidate[] {
  const usable = candidates
    .filter((frame) => frame.brightness > 20 && frame.brightness < 245 && frame.contrast > 5)
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  if (usable.length <= count) return usable;
  const distance = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + Math.abs(value - (b[index] ?? 0)), 0);
  const picks: KeyframeCandidate[] = [];
  for (let bucket = 0; bucket < count; bucket += 1) {
    const slice = usable.slice(Math.floor((bucket * usable.length) / count), Math.floor(((bucket + 1) * usable.length) / count));
    const previous = picks[picks.length - 1];
    const score = (frame: KeyframeCandidate) => frame.sharpness + (previous ? Math.min(10, distance(frame.signature, previous.signature) / 20) : 0);
    picks.push(slice.reduce((best, frame) => (score(frame) > score(best) ? frame : best)));
  }
  return picks;
}

/** Browser-made WebM files often lack a duration header; seeking far ahead makes the browser compute it. */
function probeUnknownDuration(video: HTMLVideoElement) {
  return new Promise<number | null>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeEventListener("durationchange", check);
      video.removeEventListener("timeupdate", check);
      const value = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      try {
        video.currentTime = 0;
      } catch {
        // Seeking back is best effort; frame sampling seeks again.
      }
      resolve(value);
    };
    const check = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) finish();
    };
    const timeout = window.setTimeout(finish, 8_000);
    video.addEventListener("durationchange", check);
    video.addEventListener("timeupdate", check);
    try {
      video.currentTime = 1e101;
    } catch {
      finish();
    }
  });
}

export async function extractRepresentativeFrames(
  videoBlob: Blob,
  recordedDurationSeconds?: number,
  limits: { maxBytes: number; maxSeconds: number } = { maxBytes: MAX_VIDEO_CAPTURE_BYTES, maxSeconds: MAX_CAPTURED_VIDEO_SECONDS },
): Promise<{
  frames: RoomFrame[];
  durationSeconds: number;
}> {
  if (videoBlob.size === 0 || videoBlob.size > limits.maxBytes) {
    throw new Error("video-size-invalid");
  }

  const videoUrl = URL.createObjectURL(videoBlob);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  const frames: RoomFrame[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        video.onloadedmetadata = null;
        video.onerror = null;
        if (error) reject(error);
        else resolve();
      };
      const timeout = window.setTimeout(() => finish(new Error("video-preview-timeout")), 12_000);
      video.onloadedmetadata = () => finish();
      video.onerror = () => finish(new Error("video-preview-unavailable"));
      video.src = videoUrl;
      video.load();
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) finish();
    });

    let seekableDuration: number | null = null;
    try {
      if (video.seekable.length > 0) {
        const end = video.seekable.end(video.seekable.length - 1);
        if (Number.isFinite(end) && end > 0) seekableDuration = end;
      }
    } catch {
      seekableDuration = null;
    }
    const timerDuration = typeof recordedDurationSeconds === "number" && Number.isFinite(recordedDurationSeconds) && recordedDurationSeconds > 0
      ? recordedDurationSeconds
      : null;
    const metadataDuration = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : timerDuration === null ? await probeUnknownDuration(video) : null;
    const measuredDuration = timerDuration ?? metadataDuration ?? seekableDuration;
    if (measuredDuration === null) throw new Error("video-duration-invalid");
    if (measuredDuration > limits.maxSeconds) {
      throw new Error(limits.maxSeconds > MAX_CAPTURED_VIDEO_SECONDS ? "video-too-long" : "video-duration-invalid");
    }
    const durationSeconds = Math.min(limits.maxSeconds, measuredDuration);

    const seekTo = (timestampSeconds: number) => new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        video.onseeked = null;
        video.onloadeddata = null;
        video.onerror = null;
        if (error) reject(error);
        else resolve();
      };
      const timeout = window.setTimeout(() => finish(new Error("video-frame-timeout")), 8_000);
      video.onseeked = () => finish();
      video.onloadeddata = () => {
        if (timestampSeconds === 0) finish();
      };
      video.onerror = () => finish(new Error("video-frame-unavailable"));
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Math.abs(video.currentTime - timestampSeconds) < 0.001) {
        finish();
        return;
      }
      try {
        video.currentTime = timestampSeconds;
      } catch {
        finish(new Error("video-frame-unavailable"));
      }
    });

    // Sample the whole walk, then keep 4 sharp, well-lit, visually different views spread over time.
    const sampleCount = 12;
    const lastSafe = Math.max(0, durationSeconds - 0.05);
    const candidates: KeyframeCandidate[] = [];
    for (let i = 0; i < sampleCount; i += 1) {
      const timestampSeconds = Math.max(0, Math.min(lastSafe, durationSeconds * (0.04 + (0.92 * i) / (sampleCount - 1))));
      try {
        await seekTo(timestampSeconds);
        candidates.push({ timestampSeconds, ...measureFrame(video) });
      } catch {
        // Skip a frame the browser could not seek to.
      }
    }
    let positions = selectDistinctKeyframes(candidates, 4).map((pick) => pick.timestampSeconds);
    if (positions.length < 3) {
      positions = [0.04, 0.35, 0.65, 0.96].map((fraction) => Math.max(0, Math.min(lastSafe, durationSeconds * fraction)));
    }

    for (const timestampSeconds of positions) {
      await seekTo(timestampSeconds);
      if (!video.videoWidth || !video.videoHeight) throw new Error("video-frame-unavailable");
      const frameBlob = await encodeAnalysisJpeg(video, video.videoWidth, video.videoHeight, FRAME_TARGET_BYTES);
      if (!frameBlob) throw new Error("video-frame-too-large");
      frames.push({
        id: crypto.randomUUID(),
        blob: frameBlob,
        previewUrl: URL.createObjectURL(frameBlob),
        mimeType: "image/jpeg",
        size: frameBlob.size,
        name: `walkthrough-frame-${Math.round(timestampSeconds)}s.jpg`,
        timestampSeconds: Math.round(timestampSeconds),
      });
    }

    return { frames, durationSeconds };
  } catch (error) {
    frames.forEach((frame) => URL.revokeObjectURL(frame.previewUrl));
    throw error;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(videoUrl);
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const base64 = await blobToBase64(blob);
  return `data:${blob.type || "application/octet-stream"};base64,${base64}`;
}

export async function audioBlobToWavBase64(blob: Blob): Promise<string> {
  if (blob.size === 0 || blob.size > MAX_UPLOADED_VIDEO_BYTES) throw new Error("audio-size-invalid");
  // Notes recorded as raw PCM are already WAV; no browser decoding needed (avoids iOS decode failures).
  if (blob.type === "audio/wav") return blobToBase64(blob);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtor: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AudioCtor) throw new Error("audio-decoder-unavailable");
  const context = new AudioCtor();
  let decoded: AudioBuffer;
  try {
    if (context.state === "suspended") await context.resume().catch(() => undefined);
    const bytes = await blob.arrayBuffer();
    // Older WebKit only supports the callback form of decodeAudioData.
    decoded = await new Promise<AudioBuffer>((resolve, reject) => {
      const maybe = context.decodeAudioData(bytes, resolve, reject);
      if (maybe && typeof (maybe as Promise<AudioBuffer>).then === "function") (maybe as Promise<AudioBuffer>).then(resolve, reject);
    });
  } catch {
    throw new Error("audio-decode-failed");
  } finally {
    await context.close().catch(() => undefined);
  }

  if (decoded.duration <= 0) {
    throw new Error("audio-duration-invalid");
  }

  // Longer uploaded videos send only their first minute of audio for transcription.
  const outputRate = 24_000;
  const outputLength = Math.ceil(Math.min(decoded.duration, MAX_CAPTURED_VIDEO_SECONDS) * outputRate);
  const mono = new Float32Array(decoded.length);
  for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
    const channelData = decoded.getChannelData(channel);
    for (let index = 0; index < channelData.length; index += 1) {
      mono[index] += channelData[index] / decoded.numberOfChannels;
    }
  }

  const samples = new Float32Array(outputLength);
  const ratio = decoded.sampleRate / outputRate;
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.min(mono.length - 1, Math.floor(position));
    const right = Math.min(mono.length - 1, left + 1);
    const fraction = position - left;
    samples[index] = mono[left] * (1 - fraction) + mono[right] * fraction;
  }

  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outputRate, true);
  view.setUint32(28, outputRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  const wav = new Uint8Array(buffer);
  if (wav.byteLength > 2_900_000) throw new Error("audio-size-invalid");
  return blobToBase64(new Blob([wav], { type: "audio/wav" }));
}

export function revokeMediaUrl(url?: string | null) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}
