import { describe, expect, it } from "vitest";
import { SITE_DAILY_LIMIT, VISITOR_DAILY_LIMIT } from "@/lib/analysis-limits";

describe("temporary demo recording limits", () => {
  it("allows 10 estimate runs per connection per day", () => {
    expect(VISITOR_DAILY_LIMIT).toBe(10);
  });

  it("allows 50 estimate runs site-wide per day", () => {
    expect(SITE_DAILY_LIMIT).toBe(50);
  });
});