import { describe, expect, it, vi } from "vitest";
import { buildQuoteDocument, downloadQuotePdf, pdfSafe, quoteFileName, quoteHtml, type QuoteDocRoom } from "@/lib/quote-document";
import { baseboardLengthFt } from "@/lib/room-sizes";

const pdfCalls = vi.hoisted(() => ({ saved: [] as string[], texts: [] as string[] }));
vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  class RecordingPdf extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      const draw = this.text.bind(this);
      this.text = ((text: string | string[], ...rest: unknown[]) => {
        pdfCalls.texts.push(...(Array.isArray(text) ? text : [text]));
        return (draw as (...args: unknown[]) => unknown)(text, ...rest);
      }) as typeof this.text;
      this.save = ((name: string) => {
        pdfCalls.saved.push(name);
        return this;
      }) as unknown as typeof this.save;
    }
  }
  return { ...actual, jsPDF: RecordingPdf };
});

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
    await downloadQuotePdf(doc([room("Bedroom", 794, 993)]));
    expect(pdfCalls.saved).toEqual(["walkquote-bedroom-2026-06-15.pdf"]);
    expect(pdfCalls.texts.some((text) => text.includes("$794 - $993"))).toBe(true);
    expect(pdfCalls.texts.every((text) => !/[^\x00-\xff]/.test(text))).toBe(true);
  });

  it("prints AI evidence and room specifications in the PDF and HTML", async () => {
    const graded: QuoteDocRoom = {
      ...room("Bedroom", 794, 993),
      specs: ["Crown molding: Detected", "Baseboards: Tall decorative", "Ceiling: 9'+ High", "Prep: scuffs"],
      lines: [{ label: "Crown molding painting · recommended", detail: "52 linear ft · $3.50–$5.00 per linear ft", low: 182, high: 260, evidence: "Muse Spark 1.3 — Crown molding detected along the wall-to-ceiling junction · ~52 LF" }],
    };
    pdfCalls.texts.length = 0;
    await expect(downloadQuotePdf(doc([graded]))).resolves.toBeUndefined();
    expect(pdfCalls.texts.some((text) => text.includes("AI Evidence: Muse Spark 1.3 - Crown molding"))).toBe(true);
    expect(pdfCalls.texts.some((text) => text.includes("Room specifications: Crown molding: Detected"))).toBe(true);
    expect(pdfCalls.texts.every((text) => !/[^\x00-\xff]/.test(text))).toBe(true);
    const html = quoteHtml(doc([graded]));
    expect(html).toContain("AI Evidence: Muse Spark 1.3");
    expect(html).toContain("Baseboards: Tall decorative");
  });

  it("prints site checks and the materials takeoff", async () => {
    const graded: QuoteDocRoom = {
      ...room("Bedroom", 794, 993),
      siteChecks: ["Water stains seen by Muse Spark 1.3", "Confirm on site · Ceiling painting: Water stains: check for an active leak first"],
      materials: ["Walls: Premium interior latex, eggshell · 2 coats · ~2.25 gal (buy 3 gal)", "Primer: Stain-blocking primer (spot) (1 qt)"],
    };
    pdfCalls.texts.length = 0;
    await expect(downloadQuotePdf(doc([graded]))).resolves.toBeUndefined();
    expect(pdfCalls.texts).toContain("SITE CHECKS");
    expect(pdfCalls.texts).toContain("MATERIALS");
    expect(pdfCalls.texts.some((text) => text.includes("~2.25 gal (buy 3 gal)"))).toBe(true);
    expect(pdfCalls.texts.every((text) => !/[^\x00-\xff]/.test(text))).toBe(true);
    const html = quoteHtml(doc([graded]));
    expect(html).toContain("<h3>Site checks</h3>");
    expect(html).toContain("Stain-blocking primer");
  });
});

describe("baseboard length", () => {
  it("stops at doorways", () => {
    expect(baseboardLengthFt(52, 1)).toBe(49);
    expect(baseboardLengthFt(52, null)).toBe(52);
    expect(baseboardLengthFt(16, 9)).toBe(8);
  });
});
