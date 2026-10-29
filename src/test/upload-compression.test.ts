import { describe, expect, it } from "vitest";

import { ANALYSIS_JPEG_QUALITY, ANALYSIS_MAX_DIMENSION, FRAME_TARGET_BYTES, MAX_ANALYSIS_FRAME_BYTES, MAX_COMPRESSED_PHOTO_BYTES, PHOTO_TARGET_BYTES, fitWithin } from "@/lib/room-media";

describe("Lighter uploads", () => {
  it("caps the longest side at 1280px and keeps the aspect ratio", () => {
    expect(fitWithin(3840, 2160)).toEqual({ width: 1280, height: 720 });
    expect(fitWithin(1080, 1920)).toEqual({ width: 720, height: 1280 });
  });

  it("never upscales small frames", () => {
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it("encodes at JPEG 0.82 within the server byte limits", () => {
    expect(ANALYSIS_MAX_DIMENSION).toBe(1280);
    expect(ANALYSIS_JPEG_QUALITY).toBe(0.82);
    expect(FRAME_TARGET_BYTES).toBeLessThanOrEqual(MAX_ANALYSIS_FRAME_BYTES);
    expect(PHOTO_TARGET_BYTES).toBeLessThanOrEqual(MAX_COMPRESSED_PHOTO_BYTES);
  });
});
