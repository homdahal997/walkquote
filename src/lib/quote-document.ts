import { money, moneyRange, PRICE_BOOK } from "@/lib/pricing";

export interface QuoteDocLine {
  label: string;
  detail: string;
  low: number;
  high: number;
  evidence?: string;
}

export interface QuoteDocRoom {
  label: string;
  sizeLabel: string;
  wallArea: number;
  doors: number;
  windows: number;
  lines: QuoteDocLine[];
  specs?: string[];
  siteChecks?: string[];
  materials?: string[];
  taxLow: number;
  taxHigh: number;
  low: number;
  high: number;
}

export interface QuoteDocument {
  businessName: string;
  createdAt: Date;
  colorName: string;
  colorHex: string;
  budgetLabel: string;
  rooms: QuoteDocRoom[];
  low: number;
  high: number;
  notes: string[];
}

export function buildQuoteDocument(input: Omit<QuoteDocument, "low" | "high" | "notes"> & { notes?: string[] }): QuoteDocument {
  return {
    ...input,
    low: input.rooms.reduce((sum, room) => sum + room.low, 0),
    high: input.rooms.reduce((sum, room) => sum + room.high, 0),
    notes: input.notes ?? [
      "Preliminary range from photos or a video walk analyzed with Meta Muse Spark and SAM 3.1. Room size is a visual estimate, not a tape measurement.",
      `Includes a ${PRICE_BOOK.taxAndConsumables.label} tax and consumables planning assumption. Openings deducted at 20 sq ft per door and 15 sq ft per window.`,
      "The painter confirms room size, surface condition, local pricing and final scope before any work.",
    ],
  };
}

export function quoteFileName(doc: QuoteDocument) {
  return `walkquote-${doc.rooms.length > 1 ? `${doc.rooms.length}-rooms` : slug(doc.rooms[0]?.label ?? "room")}-${doc.createdAt.toISOString().slice(0, 10)}.pdf`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "room";
}

const formatDate = (date: Date) => date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

/** One-page printable HTML for the browser's Print / Save as PDF dialog. */
export function quoteHtml(doc: QuoteDocument) {
  const compact = doc.rooms.length > 1;
  const rooms = doc.rooms.map((room) => `
    <section class="room">
      <div class="room-head"><h2>${escapeHtml(room.label)}</h2><span>${escapeHtml(room.sizeLabel)} · ${Math.round(room.wallArea)} sq ft walls · ${room.doors} door${room.doors === 1 ? "" : "s"}, ${room.windows} window${room.windows === 1 ? "" : "s"}</span></div>
      ${room.specs?.length ? `<p class="specs">${room.specs.map(escapeHtml).join(" · ")}</p>` : ""}
      <table>
        ${room.lines.map((line) => `<tr><td><strong>${escapeHtml(line.label)}</strong>${compact ? "" : `<br><small>${escapeHtml(line.detail)}</small>`}${line.evidence ? `<br><span class="evidence">&bull; AI Evidence: ${escapeHtml(line.evidence)}</span>` : ""}</td><td class="num">${moneyRange(line.low, line.high)}</td></tr>`).join("")}
        <tr class="muted"><td>Tax &amp; consumables (${PRICE_BOOK.taxAndConsumables.label})</td><td class="num">${moneyRange(room.taxLow, room.taxHigh)}</td></tr>
        <tr class="total"><td>${compact ? `${escapeHtml(room.label)} total` : "Room total"}</td><td class="num">${moneyRange(room.low, room.high)}</td></tr>
      </table>
      ${room.siteChecks?.length ? `<div class="extra"><h3>Site checks</h3><ul>${room.siteChecks.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></div>` : ""}
      ${room.materials?.length ? `<div class="extra"><h3>Materials</h3><ul>${room.materials.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></div>` : ""}
    </section>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(quoteFileName(doc).replace(/\.pdf$/, ""))}</title>
<style>
@page { size: letter; margin: 0.5in; }
* { box-sizing: border-box; }
body { margin: 0; font: ${compact ? "11px" : "12.5px"}/1.4 Georgia, "Times New Roman", serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #115e59; padding-bottom: 10px; }
header h1 { margin: 0; font-size: 24px; letter-spacing: -0.02em; }
header p { margin: 2px 0 0; color: #475569; font-family: Helvetica, Arial, sans-serif; font-size: 11px; }
.hero { display: flex; justify-content: space-between; align-items: center; margin: 14px 0; padding: 14px 16px; background: #0f172a; color: #fff; border-radius: 10px; }
.hero small { display: block; color: #5eead4; font: 700 10px Helvetica, Arial, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; }
.hero strong { font-size: 28px; }
.meta { text-align: right; font-family: Helvetica, Arial, sans-serif; font-size: 11px; }
.swatch { display: inline-block; width: 12px; height: 12px; border-radius: 50%; vertical-align: -2px; margin-right: 4px; border: 1px solid #fff6; }
.room { margin-top: 10px; break-inside: avoid; }
.room-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; border-bottom: 1px solid #cbd5e1; }
.room-head h2 { margin: 0; font-size: 16px; }
.room-head span { color: #475569; font: 10.5px Helvetica, Arial, sans-serif; }
table { width: 100%; border-collapse: collapse; }
td { padding: 4px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.specs { margin: 4px 0 2px; color: #334155; font: 10px Helvetica, Arial, sans-serif; }
.evidence { color: #047857; font: 9.5px Helvetica, Arial, sans-serif; }
.extra h3 { margin: 8px 0 2px; font: bold 9.5px Helvetica, Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.extra ul { margin: 0; padding-left: 16px; color: #334155; font: 10px Helvetica, Arial, sans-serif; }
td small { color: #64748b; font-family: Helvetica, Arial, sans-serif; }
.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.muted td { color: #64748b; }
.total td { font-weight: 700; border-bottom: 0; }
footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #cbd5e1; color: #475569; font: 9.5px/1.45 Helvetica, Arial, sans-serif; }
footer p { margin: 0 0 3px; }
</style></head><body>
<header><div><h1>${escapeHtml(doc.businessName)} · Painting quote</h1><p>Preliminary estimate prepared with WalkQuote · ${formatDate(doc.createdAt)}</p></div></header>
<div class="hero"><div><small>${compact ? `Combined range · ${doc.rooms.length} rooms` : "Estimated range"}</small><strong>${money(doc.low)} – ${money(doc.high)}</strong></div>
<div class="meta"><div><span class="swatch" style="background:${escapeHtml(doc.colorHex)}"></span>${escapeHtml(doc.colorName)} ${escapeHtml(doc.colorHex.toUpperCase())}</div><div>Budget: ${escapeHtml(doc.budgetLabel)}</div></div></div>
${rooms}
<footer>${doc.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</footer>
</body></html>`;
}

/** Opens the system print dialog (Save as PDF) from a hidden frame, so popup blockers never interfere. */
export function printQuote(doc: QuoteDocument) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const target = frame.contentWindow;
  if (!target) {
    frame.remove();
    throw new Error("print-unavailable");
  }
  target.document.open();
  target.document.write(quoteHtml(doc));
  target.document.close();
  window.setTimeout(() => {
    target.focus();
    target.print();
    window.setTimeout(() => frame.remove(), 60_000);
  }, 250);
}

/** Draws the same one-page quote straight into a PDF file and downloads it. */
export async function downloadQuotePdf(doc: QuoteDocument) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  // Built-in PDF fonts are Latin-1 only, so swap typographic dashes and quotes before drawing.
  const rawText = pdf.text.bind(pdf);
  pdf.text = ((text: string | string[], ...rest: unknown[]) => (rawText as (...args: unknown[]) => unknown)(Array.isArray(text) ? text.map(pdfSafe) : pdfSafe(text), ...rest)) as typeof pdf.text;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const right = pageWidth - margin;
  const compact = doc.rooms.length > 1;
  const body = compact ? 9 : 10.5;
  let y = margin + 8;

  pdf.setFont("helvetica", "bold").setFontSize(18).setTextColor(15, 23, 42);
  pdf.text(`${doc.businessName} · Painting quote`, margin, y);
  y += 14;
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(71, 85, 105);
  pdf.text(`Preliminary estimate prepared with WalkQuote · ${formatDate(doc.createdAt)}`, margin, y);
  y += 8;
  pdf.setDrawColor(17, 94, 89).setLineWidth(2).line(margin, y, right, y);
  y += 14;

  pdf.setFillColor(15, 23, 42).roundedRect(margin, y, right - margin, 58, 8, 8, "F");
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(94, 234, 212);
  pdf.text((compact ? `COMBINED RANGE · ${doc.rooms.length} ROOMS` : "ESTIMATED RANGE"), margin + 14, y + 18);
  pdf.setFontSize(22).setTextColor(255, 255, 255);
  pdf.text(`${money(doc.low)} – ${money(doc.high)}`, margin + 14, y + 44);
  pdf.setFont("helvetica", "normal").setFontSize(9);
  const [r, g, b] = hexToRgb(doc.colorHex);
  pdf.setFillColor(r, g, b).setDrawColor(148, 163, 184).setLineWidth(0.8).circle(right - 150, y + 21, 5, "FD");
  pdf.text(`${doc.colorName} ${doc.colorHex.toUpperCase()}`, right - 140, y + 24);
  pdf.text(`Budget: ${doc.budgetLabel}`, right - 140, y + 40);
  y += 76;

  const notesHeight = doc.notes.length * 12 + 16;
  for (const room of doc.rooms) {
    pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(15, 23, 42);
    pdf.text(room.label, margin, y);
    pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(71, 85, 105);
    pdf.text(`${room.sizeLabel} · ${Math.round(room.wallArea)} sq ft walls · ${room.doors} door${room.doors === 1 ? "" : "s"}, ${room.windows} window${room.windows === 1 ? "" : "s"}`, right, y, { align: "right" });
    y += 5;
    pdf.setDrawColor(203, 213, 225).setLineWidth(0.6).line(margin, y, right, y);
    y += 13;
    if (room.specs?.length) {
      pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(51, 65, 85);
      const specLines = pdf.splitTextToSize(pdfSafe(`Room specifications: ${room.specs.join(" | ")}`), right - margin) as string[];
      pdf.text(specLines, margin, y);
      y += specLines.length * 10 + 4;
    }
    const rows: Array<[string, string, string, boolean, string]> = [
      ...room.lines.map((line): [string, string, string, boolean, string] => [line.label, compact ? "" : line.detail, moneyRange(line.low, line.high), false, line.evidence ?? ""]),
      [`Tax & consumables (${PRICE_BOOK.taxAndConsumables.label})`, "", moneyRange(room.taxLow, room.taxHigh), false, ""],
      [compact ? `${room.label} total` : "Room total", "", moneyRange(room.low, room.high), true, ""],
    ];
    for (const [label, detail, amount, total, evidence] of rows) {
      if (y > pageHeight - margin - notesHeight) break;
      pdf.setFont("helvetica", total ? "bold" : "normal").setFontSize(body).setTextColor(15, 23, 42);
      pdf.text(label, margin, y);
      pdf.text(amount, right, y, { align: "right" });
      if (detail) {
        y += 11;
        pdf.setFontSize(8).setTextColor(100, 116, 139);
        pdf.text(detail, margin, y);
      }
      if (evidence) {
        y += 10;
        pdf.setFontSize(7.5).setTextColor(4, 120, 87);
        pdf.text(pdfSafe(`- AI Evidence: ${evidence}`), margin, y);
      }
      y += compact ? 13 : 16;
    }
    for (const [title, entries] of [["Site checks", room.siteChecks], ["Materials", room.materials]] as const) {
      if (!entries?.length || y > pageHeight - margin - notesHeight - 20) continue;
      pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(15, 23, 42);
      pdf.text(title.toUpperCase(), margin, y);
      y += 10;
      pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(51, 65, 85);
      for (const entry of entries) {
        if (y > pageHeight - margin - notesHeight) break;
        const wrapped = pdf.splitTextToSize(pdfSafe(`- ${entry}`), right - margin) as string[];
        pdf.text(wrapped, margin, y);
        y += wrapped.length * 9 + 1;
      }
      y += 4;
    }
    y += 6;
  }

  let notesY = Math.max(y, pageHeight - margin - notesHeight + 8);
  pdf.setDrawColor(203, 213, 225).line(margin, notesY - 10, right, notesY - 10);
  pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(71, 85, 105);
  for (const note of doc.notes) {
    const wrapped = pdf.splitTextToSize(note, right - margin) as string[];
    pdf.text(wrapped, margin, notesY);
    notesY += wrapped.length * 9 + 3;
  }
  pdf.save(quoteFileName(doc));
}

export function pdfSafe(value: string) {
  return value
    .replace(/[\u2012-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x00-\xff]/g, "");
}

function hexToRgb(hex: string): [number, number, number] {
  const parts = hex.replace(/^#/, "").match(/.{2}/g);
  if (!parts || parts.length !== 3) return [148, 163, 184];
  return parts.map((part) => parseInt(part, 16)) as [number, number, number];
}
