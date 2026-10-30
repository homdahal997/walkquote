import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRenderPrompt, validateRenderRequest } from "@/lib/analyze-room.shared.server";
import { runAnalyzeRoom } from "@/lib/analyze-room.server";
import { renderProgress } from "@/lib/realistic-preview";
import { RealisticPreviewControls } from "@/components/estimate/RealisticPreview";
import { MuseImageCard } from "@/components/estimate/ModelInspector";

const jpeg = `data:image/jpeg;base64,${btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, ...new Array(12).fill(0)))}`;
const attemptId = "3f2b8c1e-5d4a-4b6c-9e8f-1a2b3c4d5e6f";
const renderBody = { stage: "render", sourceId: "homeowner", attemptId, frame: jpeg, colorHex: "#b7cdd0", colorName: "Sea Glass", size: "1280x960", renderId: "a1b2c3d4" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Muse Image progress", () => {
  it("fills toward the ~25s mark, then keeps creeping without finishing", () => {
    expect(renderProgress(0)).toMatchObject({ percent: 0, step: "Sending room view" });
    expect(renderProgress(12_500)).toMatchObject({ percent: 45, step: "Repainting walls" });
    expect(renderProgress(22_000).step).toBe("Fitting to SAM 3.1 wall outline");
    expect(renderProgress(10_000).message).toMatch(/Muse Image 1.0 calculating lighting, sheen & texture/);
    const late = renderProgress(40_000);
    expect(late.message).toBe("Almost there...");
    expect(late.percent).toBeGreaterThan(90);
    expect(renderProgress(600_000).percent).toBeLessThanOrEqual(99);
  });
});

describe("Muse Image request", () => {
  it("asks for walls only and keeps trim, furniture and lighting", () => {
    const prompt = buildRenderPrompt("Sea Glass", "#B7CDD0");
    expect(prompt).toMatch(/Repaint ONLY the painted wall surfaces/);
    expect(prompt).toContain("Sea Glass (#B7CDD0)");
    expect(prompt).toMatch(/trim, baseboards, crown molding/);
    expect(prompt).toMatch(/Preserve the room's real lighting/);
  });

  it("validates the frame, color and request id", () => {
    expect(validateRenderRequest(renderBody)).toMatchObject({ colorHex: "#B7CDD0", colorName: "Sea Glass", size: "1280x960" });
    expect(validateRenderRequest({ ...renderBody, colorHex: "blue" })).toBeNull();
    expect(validateRenderRequest({ ...renderBody, renderId: "../../x" })).toBeNull();
    expect(validateRenderRequest({ ...renderBody, frame: "data:image/png;base64,AAAA" })).toBeNull();
    expect(validateRenderRequest({ ...renderBody, size: "huge", colorName: "<b>" })).toMatchObject({ size: undefined, colorName: "b" });
  });

  it("calls the Meta images/edits endpoint with muse-image-1.0 and no mask", async () => {
    vi.stubEnv("META_MODEL_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: "A".repeat(200) }], output_format: "jpeg" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const reply = await runAnalyzeRoom(renderBody, "1.2.3.4", { skipQuota: true });
    expect(reply.renderImage).toBe(`data:image/jpeg;base64,${"A".repeat(200)}`);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.meta.ai/v1/images/edits");
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ model: "muse-image-1.0", n: 1, size: "1280x960", response_format: "b64_json", images: [{ image_url: jpeg }] });
    expect(sent).not.toHaveProperty("mask");
    expect(sent).not.toHaveProperty("moderation");
  });

  it("returns a friendly message when the key has no Muse Image access", async () => {
    vi.stubEnv("META_MODEL_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reply = await runAnalyzeRoom(renderBody, "1.2.3.4", { skipQuota: true });
    expect(reply.error).toMatch(/color tint preview still works/);
  });

  it("rejects render requests that carry other stage data", async () => {
    expect(await runAnalyzeRoom({ ...renderBody, frames: [jpeg] }, "1.2.3.4", { skipQuota: true })).toEqual({ error: "Invalid request." });
    expect(await runAnalyzeRoom({ ...renderBody, sourceId: "living" }, "1.2.3.4", { skipQuota: true })).toEqual({ error: "Invalid request." });
  });

  it("returns a structured code when the Meta key is missing", async () => {
    vi.stubEnv("META_MODEL_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reply = await runAnalyzeRoom(renderBody, "1.2.3.4", { skipQuota: true });
    expect(reply).toMatchObject({ errorCode: "SERVICE_UNCONFIGURED" });
  });
});

describe("realistic preview controls", () => {
  it("shows the button, then a ticking progress panel, then the Muse Image label", () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    const { rerender } = render(<RealisticPreviewControls state={{ status: "idle" }} onStart={onStart} colorName="Sea Glass" />);
    fireEvent.click(screen.getByTestId("realistic-preview-button"));
    expect(onStart).toHaveBeenCalledTimes(1);

    rerender(<RealisticPreviewControls state={{ status: "working", startedAt: Date.now() }} onStart={onStart} colorName="Sea Glass" />);
    expect(screen.queryByTestId("realistic-preview-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("realistic-preview-elapsed")).toHaveTextContent("0s");
    act(() => { vi.advanceTimersByTime(12_000); });
    expect(screen.getByTestId("realistic-preview-elapsed")).toHaveTextContent("12s");
    expect(screen.getByTestId("realistic-preview-step")).toHaveTextContent("Repainting walls");
    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(<RealisticPreviewControls state={{ status: "done", startedAt: 1, endedAt: 2, overlayUrl: "blob:x" }} onStart={onStart} colorName="Sea Glass" />);
    expect(screen.getByTestId("realistic-preview-label")).toHaveTextContent("Rendered by Muse Image · walls bounded by SAM 3.1");
  });

  it("offers a retry after a failure", () => {
    const onStart = vi.fn();
    render(<RealisticPreviewControls state={{ status: "error", startedAt: 1, endedAt: 2, message: "Muse Image is taking longer than usual." }} onStart={onStart} colorName="Sea Glass" />);
    expect(screen.getByTestId("realistic-preview-error")).toHaveTextContent("taking longer");
    fireEvent.click(screen.getByTestId("realistic-preview-retry"));
    expect(onStart).toHaveBeenCalled();
  });

  it("shows the Muse Image step as an AI at work card", () => {
    render(<MuseImageCard status="done" timing={{ startedAt: 1_000, endedAt: 19_500 }} colorName="Sea Glass" colorHex="#B7CDD0" viewNumber={2} />);
    expect(screen.getByText("muse-image-1.0")).toBeInTheDocument();
    expect(screen.getByTestId("model-stage-clock")).toHaveTextContent("18.5s");
    expect(screen.getByTestId("model-muse-image-output")).toHaveTextContent("SAM 3.1's wall mask");
  });
});
