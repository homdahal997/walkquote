export const MAX_CAPTURED_VIDEO_SECONDS = 60;
export const TARGET_CAPTURED_VIDEO_SECONDS = 30;
export const MAX_VIDEO_CAPTURE_BYTES = 2_300_000;

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
    const maxDimension = 1_280;
    let width = bitmap.width;
    let height = bitmap.height;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    let quality = 0.8;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("photo-compression-unavailable");
      context.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw new Error("photo-compression-unavailable");
      if (blob.size <= MAX_COMPRESSED_PHOTO_BYTES) break;
      if (quality > 0.56) quality -= 0.08;
      else {
        width = Math.max(480, Math.round(width * 0.86));
        height = Math.max(360, Math.round(height * 0.86));
        quality = 0.72;
      }
    }

    if (!blob || blob.size > MAX_COMPRESSED_PHOTO_BYTES) throw new Error("photo-too-large-after-compression");
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

export async function extractRepresentativeFrames(
  videoBlob: Blob,
  recordedDurationSeconds?: number,
): Promise<{
  frames: RoomFrame[];
  durationSeconds: number;
}> {
  if (videoBlob.size === 0 || videoBlob.size > MAX_VIDEO_CAPTURE_BYTES) {
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
    const metadataDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
    const timerDuration = typeof recordedDurationSeconds === "number" && Number.isFinite(recordedDurationSeconds) && recordedDurationSeconds > 0
      ? recordedDurationSeconds
      : null;
    const measuredDuration = timerDuration ?? metadataDuration ?? seekableDuration;
    if (measuredDuration === null || measuredDuration > MAX_CAPTURED_VIDEO_SECONDS) {
      throw new Error("video-duration-invalid");
    }
    const durationSeconds = Math.min(MAX_CAPTURED_VIDEO_SECONDS, measuredDuration);

    const positions = [0.04, 0.35, 0.65, 0.96].map((fraction) =>
      Math.max(0, Math.min(Math.max(0, durationSeconds - 0.05), durationSeconds * fraction)),
    );

    for (const timestampSeconds of positions) {
      await new Promise<void>((resolve, reject) => {
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

      const maxDimension = 768;
      const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context || !video.videoWidth || !video.videoHeight) throw new Error("video-frame-unavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      let frameBlob = await canvasJpeg(canvas, 0.76);
      if (!frameBlob) throw new Error("video-frame-unavailable");
      if (frameBlob.size > MAX_ANALYSIS_FRAME_BYTES) frameBlob = await canvasJpeg(canvas, 0.58);
      if (!frameBlob || frameBlob.size > MAX_ANALYSIS_FRAME_BYTES) throw new Error("video-frame-too-large");
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
  if (blob.size === 0 || blob.size > 3_000_000) throw new Error("audio-size-invalid");
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

  if (decoded.duration <= 0 || decoded.duration > MAX_CAPTURED_VIDEO_SECONDS) {
    throw new Error("audio-duration-invalid");
  }

  const outputRate = 24_000;
  const outputLength = Math.ceil(decoded.duration * outputRate);
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
