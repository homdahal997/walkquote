import { RoomEstimateMediaChunk } from "@/entities";
import type {
  RoomEstimateMediaChunkRecord,
  RoomEstimateMediaManifest,
  RoomEstimateMediaManifestAsset,
  RoomMediaAssetRole,
} from "@/entities";
import {
  MAX_ANALYSIS_FRAME_BYTES,
  MAX_AUDIO_NOTE_BYTES,
  MAX_COMPRESSED_PHOTO_BYTES,
  MAX_VIDEO_CAPTURE_BYTES,
} from "@/lib/room-media";

export const PRIVATE_ROOM_MEDIA_CHUNK_BYTES = 48 * 1024;
const UPLOAD_CONCURRENCY = 2;
const READ_CONCURRENCY = 3;
const MAX_MEDIA_ASSETS = 5;
const MAX_TOTAL_MEDIA_BYTES = 4_000_000;
const MAX_BASE64_CHUNK_CHARS = 4 * Math.ceil(PRIVATE_ROOM_MEDIA_CHUNK_BYTES / 3);

type PrivateRoomMediaErrorCode =
  | "manifest-invalid"
  | "asset-invalid"
  | "chunk-upload-failed"
  | "chunk-unavailable"
  | "chunk-corrupt"
  | "asset-checksum-mismatch";

export class PrivateRoomMediaError extends Error {
  constructor(readonly code: PrivateRoomMediaErrorCode, message: string) {
    super(message);
    this.name = "PrivateRoomMediaError";
  }
}

export interface PrivateRoomMediaAssetInput {
  role: RoomMediaAssetRole;
  blob: Blob;
  mimeType?: string;
}

export interface PrivateRoomMediaConsentMetadata {
  primaryFrameRole: "photo" | "analysis_frame";
  primaryFrameIndex: number;
  analysisConsent: boolean;
  mediaShareConsent: boolean;
  mediaConsentAt: string;
}

interface UploadAssetState {
  assetId: string;
  role: RoomMediaAssetRole;
  mimeType: string;
  byteCount: number;
  sha256: string;
  chunkRecordIds: Array<string | undefined>;
}

const MAX_BYTES_BY_ROLE: Record<RoomMediaAssetRole, number> = {
  walkthrough_video: MAX_VIDEO_CAPTURE_BYTES,
  photo: MAX_COMPRESSED_PHOTO_BYTES,
  spoken_note: MAX_AUDIO_NOTE_BYTES,
  analysis_frame: MAX_ANALYSIS_FRAME_BYTES,
};

const DEFAULT_MIME_BY_ROLE: Record<RoomMediaAssetRole, string> = {
  walkthrough_video: "video/webm",
  photo: "image/jpeg",
  spoken_note: "audio/webm",
  analysis_frame: "image/jpeg",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isRoomMediaRole(value: unknown): value is RoomMediaAssetRole {
  return value === "walkthrough_video" || value === "photo" || value === "spoken_note" || value === "analysis_frame";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  if (value.length === 0 || value.length > MAX_BASE64_CHUNK_CHARS || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new PrivateRoomMediaError("chunk-corrupt", "A saved media part has invalid encoded data and failed its integrity check.");
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new PrivateRoomMediaError("chunk-corrupt", "A saved media part has invalid encoded data and failed its integrity check.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array) {
  let digest: ArrayBuffer;
  try {
    digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  } catch {
    throw new PrivateRoomMediaError("asset-invalid", "This browser could not verify the room media safely. Reopen the request in a current secure browser.");
  }
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function expectedPartBytes(totalBytes: number, partIndex: number) {
  return Math.min(PRIVATE_ROOM_MEDIA_CHUNK_BYTES, totalBytes - partIndex * PRIVATE_ROOM_MEDIA_CHUNK_BYTES);
}

async function runWithConcurrency(
  count: number,
  concurrency: number,
  worker: (index: number) => Promise<void>,
) {
  let nextIndex = 0;
  let failed = false;
  let failure: unknown;

  await Promise.all(Array.from({ length: Math.min(count, concurrency) }, async () => {
    while (!failed) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= count) return;
      try {
        await worker(index);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
  }));

  if (failed) throw failure;
}

function assetMimeType(input: PrivateRoomMediaAssetInput) {
  const fallback = DEFAULT_MIME_BY_ROLE[input.role];
  return (input.mimeType || input.blob.type || fallback).trim().toLowerCase();
}

function validateAssetInput(input: PrivateRoomMediaAssetInput) {
  if (!input || !isRoomMediaRole(input.role) || !(input.blob instanceof Blob)) {
    throw new PrivateRoomMediaError("asset-invalid", "One of the selected room media files could not be prepared.");
  }
  const mimeType = assetMimeType(input);
  const family = input.role === "walkthrough_video"
    ? "video/"
    : input.role === "spoken_note"
      ? "audio/"
      : "image/";
  if (!mimeType.startsWith(family) || mimeType.length > 120 || input.blob.size <= 0 || input.blob.size > MAX_BYTES_BY_ROLE[input.role]) {
    throw new PrivateRoomMediaError("asset-invalid", "A selected room media file is empty, too large, or has an unsupported format. Review the capture and try again.");
  }
  return mimeType;
}

function validateInputSet(inputs: PrivateRoomMediaAssetInput[]) {
  if (!Array.isArray(inputs) || inputs.length < 3 || inputs.length > MAX_MEDIA_ASSETS) {
    throw new PrivateRoomMediaError("asset-invalid", "The request needs a complete video walkthrough or three to four room photos.");
  }
  const seenBlobs = new Set<Blob>();
  for (const input of inputs) {
    validateAssetInput(input);
    if (seenBlobs.has(input.blob)) {
      throw new PrivateRoomMediaError("asset-invalid", "The same media file cannot be attached more than once.");
    }
    seenBlobs.add(input.blob);
  }

  const count = (role: RoomMediaAssetRole) => inputs.filter((input) => input.role === role).length;
  const videos = count("walkthrough_video");
  const photos = count("photo");
  const notes = count("spoken_note");
  const frames = count("analysis_frame");
  const validVideoSet = videos === 1 && photos === 0 && notes === 0 && frames === 4 && inputs.length === 5;
  const validPhotoSet = videos === 0 && photos >= 3 && photos <= 4 && notes <= 1 && frames === 0 && inputs.length === photos + notes;
  if (!validVideoSet && !validPhotoSet) {
    throw new PrivateRoomMediaError("asset-invalid", "The selected room media is incomplete. Choose one video with its four review frames, or three to four photos.");
  }
}

export function validatePrivateRoomMediaManifest(value: unknown): RoomEstimateMediaManifest {
  const invalid = () => new PrivateRoomMediaError("manifest-invalid", "This request has an invalid protected media manifest. Contact the project administrator before using its media.");
  if (!isRecord(value) || value.version !== 1 || typeof value.upload_group_id !== "string" || value.upload_group_id.length < 8 || value.upload_group_id.length > 128) {
    throw invalid();
  }
  if (!Array.isArray(value.assets) || value.assets.length < 3 || value.assets.length > MAX_MEDIA_ASSETS) throw invalid();

  const assets: RoomEstimateMediaManifestAsset[] = [];
  const assetIds = new Set<string>();
  const chunkIds = new Set<string>();
  let totalByteCount = 0;

  for (const rawAsset of value.assets) {
    if (!isRecord(rawAsset) || !isRoomMediaRole(rawAsset.role)) throw invalid();
    const role = rawAsset.role;
    const mimeType = typeof rawAsset.mime_type === "string" ? rawAsset.mime_type.trim().toLowerCase() : "";
    const expectedFamily = role === "walkthrough_video" ? "video/" : role === "spoken_note" ? "audio/" : "image/";
    const byteCount = rawAsset.byte_count;
    const sha256 = rawAsset.sha256;
    const assetId = rawAsset.asset_id;
    const ids = rawAsset.chunk_record_ids;

    if (
      typeof assetId !== "string" || assetId.length < 8 || assetId.length > 128 || assetIds.has(assetId) ||
      !mimeType.startsWith(expectedFamily) || mimeType.length > 120 ||
      typeof byteCount !== "number" || !Number.isSafeInteger(byteCount) || byteCount <= 0 || byteCount > MAX_BYTES_BY_ROLE[role] ||
      typeof sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(sha256) ||
      !Array.isArray(ids) || ids.length !== Math.ceil(byteCount / PRIVATE_ROOM_MEDIA_CHUNK_BYTES)
    ) {
      throw invalid();
    }

    assetIds.add(assetId);
    totalByteCount += byteCount;
    const partCount = Math.ceil(byteCount / PRIVATE_ROOM_MEDIA_CHUNK_BYTES);
    const orderedIds: string[] = [];
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      if (typeof id !== "string" || id.length === 0 || id.length > 160 || chunkIds.has(id)) throw invalid();
      chunkIds.add(id);
      orderedIds.push(id);
    }
    if (orderedIds.length !== partCount) throw invalid();

    assets.push({
      asset_id: assetId,
      role,
      mime_type: mimeType,
      byte_count: byteCount,
      sha256: sha256.toLowerCase(),
      chunk_record_ids: orderedIds,
    });
  }

  if (totalByteCount > MAX_TOTAL_MEDIA_BYTES) throw invalid();

  const videoCount = assets.filter((asset) => asset.role === "walkthrough_video").length;
  const photoCount = assets.filter((asset) => asset.role === "photo").length;
  const noteCount = assets.filter((asset) => asset.role === "spoken_note").length;
  const frameCount = assets.filter((asset) => asset.role === "analysis_frame").length;
  const isVideoManifest = videoCount === 1 && photoCount === 0 && noteCount === 0 && frameCount === 4 && assets.length === 5;
  const isPhotoManifest = videoCount === 0 && photoCount >= 3 && photoCount <= 4 && noteCount <= 1 && frameCount === 0 && assets.length === photoCount + noteCount;
  if (!isVideoManifest && !isPhotoManifest) throw invalid();

  const primaryFrameRole = value.primary_frame_role;
  const primaryFrameIndex = value.primary_frame_index;
  const expectedPrimaryRole = isVideoManifest ? "analysis_frame" : "photo";
  const primaryAssetCount = assets.filter((asset) => asset.role === expectedPrimaryRole).length;
  const consentAt = value.media_consent_at;
  if (
    primaryFrameRole !== expectedPrimaryRole || typeof primaryFrameIndex !== "number" || !Number.isInteger(primaryFrameIndex) ||
    primaryFrameIndex < 0 || primaryFrameIndex >= primaryAssetCount || value.analysis_consent !== true ||
    value.media_share_consent !== true || typeof consentAt !== "string" || !Number.isFinite(Date.parse(consentAt))
  ) {
    throw invalid();
  }

  return {
    version: 1,
    upload_group_id: value.upload_group_id,
    assets,
    primary_frame_role: expectedPrimaryRole,
    primary_frame_index: primaryFrameIndex,
    analysis_consent: true,
    media_share_consent: true,
    media_consent_at: consentAt,
  };
}

export class PrivateRoomMediaUploadSession {
  readonly uploadGroupId = crypto.randomUUID();
  private readonly statesByBlob = new WeakMap<Blob, Map<RoomMediaAssetRole, UploadAssetState>>();

  private async stateFor(input: PrivateRoomMediaAssetInput) {
    const mimeType = validateAssetInput(input);
    let byRole = this.statesByBlob.get(input.blob);
    if (!byRole) {
      byRole = new Map<RoomMediaAssetRole, UploadAssetState>();
      this.statesByBlob.set(input.blob, byRole);
    }

    const existing = byRole.get(input.role);
    if (existing) {
      if (existing.mimeType !== mimeType || existing.byteCount !== input.blob.size) {
        throw new PrivateRoomMediaError("asset-invalid", "The selected media changed after upload started. Review the capture and retry.");
      }
      return existing;
    }

    const bytes = new Uint8Array(await input.blob.arrayBuffer());
    const partCount = Math.ceil(bytes.byteLength / PRIVATE_ROOM_MEDIA_CHUNK_BYTES);
    const state: UploadAssetState = {
      assetId: crypto.randomUUID(),
      role: input.role,
      mimeType,
      byteCount: bytes.byteLength,
      sha256: await sha256Hex(bytes),
      chunkRecordIds: new Array(partCount),
    };
    byRole.set(input.role, state);
    return state;
  }

  private async uploadAsset(input: PrivateRoomMediaAssetInput): Promise<RoomEstimateMediaManifestAsset> {
    const state = await this.stateFor(input);
    const partCount = Math.ceil(state.byteCount / PRIVATE_ROOM_MEDIA_CHUNK_BYTES);

    await runWithConcurrency(partCount, UPLOAD_CONCURRENCY, async (partIndex) => {
      if (state.chunkRecordIds[partIndex]) return;
      const start = partIndex * PRIVATE_ROOM_MEDIA_CHUNK_BYTES;
      const expectedBytes = expectedPartBytes(state.byteCount, partIndex);
      const part = new Uint8Array(await input.blob.slice(start, start + expectedBytes).arrayBuffer());
      if (part.byteLength !== expectedBytes) {
        throw new PrivateRoomMediaError("asset-invalid", "A room media part could not be read. Keep this page open and retry.");
      }
      const checksum = await sha256Hex(part);
      const payloadBase64 = bytesToBase64(part);

      let created: RoomEstimateMediaChunkRecord;
      try {
        created = await RoomEstimateMediaChunk.create({
          upload_group_id: this.uploadGroupId,
          asset_id: state.assetId,
          part_index: partIndex,
          part_count: partCount,
          raw_byte_count: part.byteLength,
          payload_base64: payloadBase64,
          checksum_sha256: checksum,
        });
      } catch {
        throw new PrivateRoomMediaError("chunk-upload-failed", "Some room media parts could not be saved. Keep this page open and retry; confirmed parts will be reused.");
      }

      if (!created || typeof created.id !== "string" || created.id.length === 0) {
        throw new PrivateRoomMediaError("chunk-upload-failed", "A room media part was saved without a usable record ID. Keep this page open and retry the request.");
      }
      state.chunkRecordIds[partIndex] = created.id;
      if (
        created.upload_group_id !== this.uploadGroupId || created.asset_id !== state.assetId ||
        created.part_index !== partIndex || created.part_count !== partCount ||
        created.raw_byte_count !== expectedBytes || created.checksum_sha256 !== checksum
      ) {
        state.chunkRecordIds[partIndex] = undefined;
        throw new PrivateRoomMediaError("chunk-upload-failed", "A saved room media part did not pass its verification check. Keep this page open and retry.");
      }
    });

    const chunkRecordIds = state.chunkRecordIds.map((id) => id ?? "");
    const recordedByteCount = chunkRecordIds.reduce((total, _id, index) => total + expectedPartBytes(state.byteCount, index), 0);
    if (chunkRecordIds.some((id) => id.length === 0) || recordedByteCount !== state.byteCount) {
      throw new PrivateRoomMediaError("chunk-upload-failed", "The room media upload is incomplete. Keep this page open and retry; confirmed parts will be reused.");
    }

    return {
      asset_id: state.assetId,
      role: state.role,
      mime_type: state.mimeType,
      byte_count: state.byteCount,
      sha256: state.sha256,
      chunk_record_ids: chunkRecordIds,
    };
  }

  async uploadAssets(
    inputs: PrivateRoomMediaAssetInput[],
    metadata: PrivateRoomMediaConsentMetadata,
  ): Promise<RoomEstimateMediaManifest> {
    validateInputSet(inputs);
    if (
      !metadata || !Number.isInteger(metadata.primaryFrameIndex) || metadata.primaryFrameIndex < 0 ||
      (metadata.primaryFrameRole !== "photo" && metadata.primaryFrameRole !== "analysis_frame") ||
      metadata.analysisConsent !== true || metadata.mediaShareConsent !== true ||
      typeof metadata.mediaConsentAt !== "string" || !Number.isFinite(Date.parse(metadata.mediaConsentAt))
    ) {
      throw new PrivateRoomMediaError("manifest-invalid", "Confirm both media permissions before sending the room estimate.");
    }

    const requestedByteCount = inputs.reduce((total, input) => total + input.blob.size, 0);
    if (requestedByteCount > MAX_TOTAL_MEDIA_BYTES) {
      throw new PrivateRoomMediaError("asset-invalid", "This room media could not be saved. Try again or use 3–4 photos instead.");
    }

    const assets: RoomEstimateMediaManifestAsset[] = [];
    for (const input of inputs) assets.push(await this.uploadAsset(input));

    const totalByteCount = assets.reduce((total, asset) => total + asset.byte_count, 0);
    if (totalByteCount > MAX_TOTAL_MEDIA_BYTES) {
      throw new PrivateRoomMediaError("asset-invalid", "This room media could not be saved. Try again or use 3–4 photos instead.");
    }

    return validatePrivateRoomMediaManifest({
      version: 1,
      upload_group_id: this.uploadGroupId,
      assets,
      primary_frame_role: metadata.primaryFrameRole,
      primary_frame_index: metadata.primaryFrameIndex,
      analysis_consent: metadata.analysisConsent,
      media_share_consent: metadata.mediaShareConsent,
      media_consent_at: metadata.mediaConsentAt,
    });
  }
}

async function loadAssetBlob(
  manifest: RoomEstimateMediaManifest,
  asset: RoomEstimateMediaManifestAsset,
): Promise<Blob> {
  const partCount = asset.chunk_record_ids.length;
  const records: Array<RoomEstimateMediaChunkRecord | undefined> = new Array(partCount);
  await runWithConcurrency(partCount, READ_CONCURRENCY, async (partIndex) => {
    const recordId = asset.chunk_record_ids[partIndex];
    try {
      records[partIndex] = await RoomEstimateMediaChunk.get(recordId);
    } catch {
      throw new PrivateRoomMediaError("chunk-unavailable", "One or more protected media parts are missing or could not be opened. Close and reopen this request to retry.");
    }
  });

  const bytes = new Uint8Array(asset.byte_count);
  let totalByteCount = 0;
  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    const record = records[partIndex];
    const recordId = asset.chunk_record_ids[partIndex];
    const expectedBytes = expectedPartBytes(asset.byte_count, partIndex);
    if (
      !record || record.id !== recordId || record.upload_group_id !== manifest.upload_group_id ||
      record.asset_id !== asset.asset_id || record.part_index !== partIndex || record.part_count !== partCount ||
      record.raw_byte_count !== expectedBytes || typeof record.payload_base64 !== "string" ||
      typeof record.checksum_sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(record.checksum_sha256) ||
      record.payload_base64.length !== 4 * Math.ceil(expectedBytes / 3)
    ) {
      throw new PrivateRoomMediaError("chunk-corrupt", "A protected room media part is missing, out of order, or failed its integrity check.");
    }

    const part = base64ToBytes(record.payload_base64);
    if (part.byteLength !== expectedBytes || (await sha256Hex(part)) !== record.checksum_sha256.toLowerCase()) {
      throw new PrivateRoomMediaError("chunk-corrupt", "A protected room media part failed its SHA-256 integrity check. Do not use this media until the administrator reviews it.");
    }
    bytes.set(part, partIndex * PRIVATE_ROOM_MEDIA_CHUNK_BYTES);
    totalByteCount += part.byteLength;
  }

  if (totalByteCount !== asset.byte_count || (await sha256Hex(bytes)) !== asset.sha256) {
    throw new PrivateRoomMediaError("asset-checksum-mismatch", "The saved room media failed its full-file integrity check. Do not use this media until the administrator reviews it.");
  }
  return new Blob([bytes], { type: asset.mime_type });
}

export async function loadPrivateRoomMediaAssets(value: unknown): Promise<Map<string, Blob>> {
  const manifest = validatePrivateRoomMediaManifest(value);
  const assets = new Map<string, Blob>();
  for (const asset of manifest.assets) {
    assets.set(asset.asset_id, await loadAssetBlob(manifest, asset));
  }
  return assets;
}

export function createPrivateRoomMediaObjectUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

export function revokePrivateRoomMediaObjectUrl(url?: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}
