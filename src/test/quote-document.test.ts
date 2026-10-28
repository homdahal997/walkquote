import { describe, expect, it, vi } from "vitest";
import { buildQuoteDocument, downloadQuotePdf, pdfSafe, quoteFileName, quoteHtml, type QuoteDocRoom } from "@/lib/quote-document";
import { baseboardLengthFt } from "@/lib/room-sizes";

const room = (label: string, low: number, high: number): QuoteDocRoom => ({
  label,
  sizeLabel: "12 × 14 ft, 8 ft ceiling",
  wallArea: 366,
  doors: 1,
  windows: 2,
  lines: [{ label: "Wall painting · two coats", detail: "366 sq ft · $2.00–$2.50 per sq ft", low: 732, high: 915 }],
  taxLow: 62,
  taxHigh: 78,
  low,
  high,
});

const doc = (rooms: QuoteDocRoom[]) => buildQuoteDocument({
  businessName: "Demo Painting Co.",
  createdAt: new Date("2026-06-15T12:00:00Z"),
  colorName: "Soft <White>",
  colorHex: "#f4f1ea",
  budgetLabel: "$1,500",
  rooms,
});

describe("printable quote", () => {
  it("sums rooms and names the file", () => {
    const single = doc([room("Bedroom", 794, 993)]);
    expect(single.low).toBe(794);
    expect(quoteFileName(single)).toBe("walkquote-bedroom-2026-06-15.pdf");
    const combined = doc([room("Bedroom", 794, 993), room("Living room", 1000, 1300)]);
    expect([combined.low, combined.high]).toEqual([1794, 2293]);
    expect(quoteFileName(combined)).toBe("walkquote-2-rooms-2026-06-15.pdf");
  });

  it("renders escaped one-page HTML with the range and every room", () => {
    const html = quoteHtml(doc([room("Bedroom", 794, 993), room("Kitchen", 500, 600)]));
    expect(html).toContain("Combined range · 2 rooms");
    expect(html).toContain("Kitchen total");
    expect(html).toContain("Soft &lt;White&gt;");
    expect(html).not.toContain("<White>");
    expect(html).toContain("size: letter");
  });

  it("keeps PDF text Latin-1 safe", () => {
    expect(pdfSafe("$700–$900 · 12 × 14 “ok”")).toBe('$700-$900 · 12 × 14 "ok"');
  });

  it("draws and saves a PDF without errors", async () => {
    const { jsPDF } = await import("jspdf");
    const save = vi.spyOn(jsPDF.API, "save").mockImplementation(function (this: unknown) { return this as never; });
    await downloadQuotePdf(doc([room("Bedroom", 794, 993)]));
    expect(save).toHaveBeenCalledWith("walkquote-bedroom-2026-06-15.pdf");
    save.mockRestore();
  });
});

describe("baseboard length", () => {
  it("stops at doorways", () => {
    expect(baseboardLengthFt(52, 1)).toBe(49);
    expect(baseboardLengthFt(52, null)).toBe(52);
    expect(baseboardLengthFt(16, 9)).toBe(8);
  });
});
