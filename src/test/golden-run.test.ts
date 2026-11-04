import { describe, expect, it } from "vitest";
import { canSubmitRoom } from "@/lib/golden-run";

describe("saved demo separation", () => {
  it("blocks saved real-model replays from submitting leads", () => {
    expect(canSubmitRoom("homeowner", true)).toBe(false);
  });
  it("blocks illustrative samples from submitting leads", () => {
    expect(canSubmitRoom("demo", false)).toBe(false);
  });
  it("allows real homeowner estimates to submit", () => {
    expect(canSubmitRoom("homeowner", false)).toBe(true);
  });
});