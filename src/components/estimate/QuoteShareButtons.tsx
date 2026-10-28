import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { downloadQuotePdf, printQuote, type QuoteDocument } from "@/lib/quote-document";

interface QuoteShareButtonsProps {
  getDocument: () => QuoteDocument | null;
  tone?: "dark" | "light";
}

export function QuoteShareButtons({ getDocument, tone = "light" }: QuoteShareButtonsProps) {
  const [downloading, setDownloading] = useState(false);
  const base = "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60";
  const style = tone === "dark" ? "border-white/20 bg-white/5 text-white hover:bg-white/10" : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50";

  const download = async () => {
    const doc = getDocument();
    if (!doc) return;
    setDownloading(true);
    try {
      await downloadQuotePdf(doc);
    } catch {
      toast.error("The PDF could not be created. Try Print / Save as PDF instead.");
    } finally {
      setDownloading(false);
    }
  };

  const print = () => {
    const doc = getDocument();
    if (!doc) return;
    try {
      printQuote(doc);
    } catch {
      toast.error("Printing is not available in this browser. Try Download PDF instead.");
    }
  };

  return (
    <div className="flex flex-wrap gap-2" data-testid="quote-share-buttons">
      <button type="button" data-testid="download-quote-pdf-btn" onClick={download} disabled={downloading} className={`${base} ${style}`}>{downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download PDF</button>
      <button type="button" data-testid="print-quote-btn" onClick={print} className={`${base} ${style}`}><Printer size={16} /> Print / Save as PDF</button>
    </div>
  );
}
