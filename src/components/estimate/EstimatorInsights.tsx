import { AlertTriangle, AudioLines, Check, PaintBucket, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { LEAD_SAFE_NOTE, materialsTakeoff, reconcileVoiceVision, type SamCounts } from "@/lib/estimator-insights";
import { ISSUE_LABELS } from "@/lib/pricing";
import type { RoomAssessment, ScopeLine } from "@/types/estimate";

export function ConfidenceChip({ item }: { item: ScopeLine }) {
  if (!item.confidence) return null;
  const grounded = item.confidence === "grounded";
  return (
    <p data-testid={`scope-confidence-${item.id}`} className={`mt-1.5 inline-flex max-w-full items-start gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-4 ${grounded ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
      {grounded ? <ShieldCheck size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <span>{grounded ? "Grounded" : `Confirm on site · ${item.confidenceNote}`}</span>
    </p>
  );
}

function Card({ testId, icon, eyebrow, title, children }: { testId: string; icon: ReactNode; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div data-testid={testId} className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-800">{icon}</span><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">{eyebrow}</p><h3 className="text-lg font-semibold text-slate-950">{title}</h3></div></div>
      {children}
    </div>
  );
}

export function SiteChecksCard({ assessment, includedItems }: { assessment: RoomAssessment; includedItems: ScopeLine[] }) {
  const issues = assessment.surfaceConditions?.issues ?? [];
  const flagged = includedItems.filter((item) => item.confidence === "confirm_on_site");
  const grounded = includedItems.filter((item) => item.confidence === "grounded").length;
  if (!assessment.surfaceConditions && !flagged.length) return null;
  return (
    <Card testId="site-checks-card" icon={<AlertTriangle size={19} />} eyebrow="Muse Spark 1.3 · conditions" title="Condition & confidence">
      <p data-testid="site-checks-summary" className="mt-3 text-sm leading-6 text-slate-700">{grounded} line{grounded === 1 ? "" : "s"} grounded in the photos · {flagged.length} to confirm on site</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {issues.length ? issues.map((issue) => <span key={issue} data-testid={`condition-${issue}`} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950">{ISSUE_LABELS[issue]}</span>)
          : <span data-testid="condition-none" className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">No peeling, stains, cracks or mildew seen</span>}
      </div>
      {assessment.surfaceConditions?.leadPaintCaution && <p data-testid="lead-paint-caution" role="note" className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-5 text-amber-950">{LEAD_SAFE_NOTE}</p>}
      {flagged.length > 0 && <ul className="mt-3 space-y-1.5">{flagged.map((item) => <li key={item.id} className="text-sm leading-5 text-slate-700"><strong className="text-slate-900">{item.label}:</strong> {item.confidenceNote}</li>)}</ul>}
    </Card>
  );
}

export function VoiceVisionCard({ transcript, assessment, sam }: { transcript: string; assessment: RoomAssessment; sam?: SamCounts }) {
  const checks = reconcileVoiceVision(transcript, assessment, sam);
  if (!transcript.trim()) return null;
  return (
    <Card testId="voice-vision-card" icon={<AudioLines size={19} />} eyebrow="Muse Voice × Muse Spark × SAM 3.1" title="Voice vs vision">
      {checks.length ? (
        <ul className="mt-3 space-y-2">
          {checks.map((check) => (
            <li key={check.id} data-testid={`voice-check-${check.id}`} className={`flex gap-2 rounded-xl px-3 py-2.5 text-sm leading-5 ${check.status === "conflict" ? "bg-amber-50 text-amber-950" : check.status === "match" ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-800"}`}>
              {check.status === "conflict" ? <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />}
              <span><strong>{check.topic}:</strong> {check.message}</span>
            </li>
          ))}
        </ul>
      ) : <p data-testid="voice-check-none" className="mt-3 text-sm leading-6 text-slate-600">Your note had no counts or scope requests to cross-check against the camera.</p>}
    </Card>
  );
}

export function MaterialsCard({ includedItems, assessment }: { includedItems: ScopeLine[]; assessment: RoomAssessment }) {
  const takeoff = materialsTakeoff(includedItems, assessment);
  if (!takeoff.lines.length) return null;
  return (
    <Card testId="materials-card" icon={<PaintBucket size={19} />} eyebrow="Takeoff · 350 sq ft per gallon per coat" title="Materials">
      <ul className="mt-3 divide-y divide-slate-100">
        {takeoff.lines.map((line) => (
          <li key={line.id} data-testid={`material-${line.id}`} className="flex items-start justify-between gap-3 py-2.5 text-sm">
            <span><strong className="text-slate-900">{line.surface}</strong><br /><span className="text-slate-600">{line.product} · {line.sheen} · {line.coats} coats · {line.areaSqFt} sq ft</span></span>
            <span className="shrink-0 text-right tabular-nums"><strong className="text-slate-950">{line.gallons} gal</strong><br /><span className="text-xs text-slate-500">buy {line.buy}</span></span>
          </li>
        ))}
      </ul>
      <div data-testid="material-primer" className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-5">
        <p className="font-semibold text-slate-900">Primer: {takeoff.primerRequired ? "required" : "not required"}</p>
        {takeoff.primerRequired
          ? <ul className="mt-1 space-y-1 text-slate-700">{takeoff.primer.map((need) => <li key={need.product}>{need.product} · buy {need.buy}. <span className="text-slate-500">{need.reason}</span></li>)}</ul>
          : <p className="mt-1 text-slate-600">Sound, previously painted surfaces take the topcoat directly.</p>}
      </div>
      <p data-testid="materials-total" className="mt-3 text-sm font-semibold text-slate-900">Total finish paint: ~{takeoff.totalGallons} gal</p>
    </Card>
  );
}
