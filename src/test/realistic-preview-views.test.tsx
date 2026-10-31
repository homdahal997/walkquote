import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRealisticPreview } from "@/components/estimate/RealisticPreview";

const mocks = vi.hoisted(() => ({ analyze: vi.fn(), compose: vi.fn() }));
vi.mock("@/functions", () => ({ analyzeRoom: mocks.analyze }));
vi.mock("@/lib/realistic-preview", () => ({
  composeWallRender: mocks.compose,
  imageSize: async () => ({ width: 1280, height: 960 }),
  newRenderId: () => "test-render",
  renderProgress: vi.fn(),
  RENDER_TIMEOUT_MS: 60000,
}));

afterEach(() => vi.clearAllMocks());

describe("realistic repaint across four video views", () => {
  it("sends each selected frame without borrowing a different view's mask and reuses cached renders", async () => {
    mocks.analyze.mockResolvedValue({ renderImage: "data:image/jpeg;base64,edited" });
    mocks.compose.mockImplementation(async (url: string) => `blob:render-${url}`);
    const source = { attemptId: "room-one", frameDataUrls: ["frame-1", "frame-2", "frame-3", "frame-4"] };
    const mask = { width: 1, height: 1, dataBase64: "gA==", regions: [] };
    vi.stubGlobal("URL", { revokeObjectURL: vi.fn() });
    const { result, rerender, unmount } = renderHook(({ index }) => useRealisticPreview({
      source, frameIndex: index, originalUrl: `view-${index + 1}`, mask: index === 0 ? mask : null,
      color: { name: "Sea Glass", hex: "#B7CDD0" },
    }), { initialProps: { index: 0 } });
    for (let index = 0; index < 4; index += 1) {
      rerender({ index });
      expect(result.current.available).toBe(true);
      await act(async () => { await result.current.start(); });
      expect(mocks.analyze).toHaveBeenLastCalledWith(expect.objectContaining({ frame: source.frameDataUrls[index] }));
      expect(mocks.compose).toHaveBeenLastCalledWith(`view-${index + 1}`, "data:image/jpeg;base64,edited", index === 0 ? mask : null);
      expect(result.current.state).toMatchObject({ status: "done", overlayUrl: `blob:render-view-${index + 1}` });
    }
    rerender({ index: 0 });
    expect(result.current.state).toMatchObject({ status: "done", overlayUrl: "blob:render-view-1" });
    expect(mocks.analyze).toHaveBeenCalledTimes(4);
    unmount();
    vi.unstubAllGlobals();
  });
});