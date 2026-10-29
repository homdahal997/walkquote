import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ModelInspector } from "@/components/estimate/ModelInspector";
import type { MaskData, ModelTrace } from "@/types/estimate";

// jsdom has no 2D canvas; the overlay must still render without one.
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

const wallMask: MaskData = {
  width: 8,
  height: 2,
  dataBase64: btoa(String.fromCharCode(0xff, 0x0f)),
  regions: [{ left: 0, top: 0, right: 8, bottom: 2 }],
};

function trace(overrides: Partial<ModelTrace> = {}): ModelTrace {
  return {
    noteSource: "video-audio",
    frameCount: 4,
    transcript: "",
    observations: [],
    assessment: { visibleDoorCount: null, visibleWindowCount: null, visibleMarkCount: null, wallTone: "unknown", scaleReference: "none", suggestedDimensions: null, openingDeductionSqFt: null },
    wallMask: null,
    trimMask: null,
    openingMask: null,
    frameWallMasks: [],
    samDoorCounts: [],
    samWindowCounts: [],
    stageTimings: [],
    ...overrides,
  };
}

describe("AI at work panel", () => {
  it("shows all three Meta models queued before analysis starts", () => {
    render(<ModelInspector trace={trace()} statuses={["pending", "pending", "pending", "pending"]} frameUrl="" />);

    expect(screen.getByText("muse-voice-transcribe-1.0")).toBeInTheDocument();
    expect(screen.getByText("muse-spark-1.3")).toBeInTheDocument();
    expect(screen.getByText("sam-3.1")).toBeInTheDocument();
    expect(screen.getAllByText("Queued")).toHaveLength(3);
  });

  it("marks the running model and shows its live clock", () => {
    render(<ModelInspector trace={trace({ stageTimings: [{ startedAt: 1, endedAt: 2 }, { startedAt: Date.now() }] })} statuses={["done", "working", "pending", "pending"]} frameUrl="" />);

    expect(screen.getByTestId("model-card-spark")).toHaveAttribute("data-status", "working");
    expect(within(screen.getByTestId("model-card-spark")).getByTestId("model-stage-clock")).toBeInTheDocument();
  });

  it("renders the real model outputs once each stage is done", () => {
    render(
      <ModelInspector
        trace={trace({
          transcript: "Paint the walls warm white",
          observations: ["Light gray walls"],
          assessment: {
            visibleDoorCount: 1,
            visibleWindowCount: 2,
            visibleMarkCount: 0,
            wallTone: "light",
            scaleReference: "standard_door",
            suggestedDimensions: { lengthFt: 14, widthFt: 12, ceilingHeightFt: 8, confidence: "medium", basis: "Estimated from door height." },
            openingDeductionSqFt: 51,
            roomType: "bedroom",
            visibleWallCount: 4,
          },
          wallMask,
          frameWallMasks: [wallMask, null, wallMask, null],
          samDoorCounts: [1, 0, null, 0],
          samWindowCounts: [0, 2, 0, 0],
        })}
        statuses={["done", "done", "done", "working"]}
        frameUrl="data:image/gif;base64,R0lGODlhAQABAAAAACw="
      />,
    );

    expect(screen.getByTestId("model-voice-transcript")).toHaveTextContent("Paint the walls warm white");
    expect(screen.getByTestId("model-spark-room-type")).toHaveTextContent("Bedroom");
    expect(screen.getByTestId("model-spark-dimensions")).toHaveTextContent("14 × 12 ft · 8 ft ceiling");
    expect(screen.getByTestId("model-sam-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("model-sam-summary")).toHaveTextContent("Wall masks on 2 of 4 views · 1 door and 2 windows detected");
  });

  it("explains a skipped segmentation instead of showing an empty overlay", () => {
    render(<ModelInspector trace={trace()} statuses={["skipped", "done", "skipped", "pending"]} frameUrl="" />);

    expect(screen.queryByTestId("model-sam-overlay")).not.toBeInTheDocument();
    expect(screen.getByText(/No usable surface mask came back/)).toBeInTheDocument();
  });
});
