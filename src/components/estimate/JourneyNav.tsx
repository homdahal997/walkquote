import { ArrowUpRight, Check } from "lucide-react";
import { Link } from "react-router-dom";

interface HeroHeaderProps {
  brandMark: string;
  demo?: boolean;
  compact?: boolean;
  landing?: boolean;
}

export function HeroHeader({ brandMark, demo = false, compact = false, landing = false }: HeroHeaderProps) {
  return (
    <header className={`wq-header ${landing ? "wq-header-landing" : ""} ${compact ? "max-sm:!bg-white max-sm:!text-slate-950 max-sm:!border-slate-200" : ""}`}>
      <div className={`wq-header-inner ${compact ? "max-sm:!min-h-14" : ""}`}>
        <Link to="/" className="wq-brand" aria-label="WalkQuote, room estimates for interior paint and drywall, home">
          <img className={`wq-brand-mark ${compact ? "max-sm:!h-9 max-sm:!w-9" : ""}`} src={brandMark} alt="" />
          <span className="wq-brand-lockup">
            <span className="wq-brand-name">WalkQuote</span>
            <span className={`wq-brand-subtitle wq-brand-subtitle-full ${compact ? "max-sm:hidden" : ""}`}>Room estimate · paint + drywall</span>
            <span className="wq-brand-subtitle wq-brand-subtitle-mobile" aria-hidden="true">Room estimates</span>
          </span>
        </Link>
        <div className={`wq-header-right ${compact ? "max-sm:hidden" : ""}`}>
          <span className="wq-demo-status"><span className="wq-status-dot" />{demo ? "DEMO ROOM" : "ONE ROOM · PILOT"}</span>
          <Link className="wq-header-link" to="/contractor">
            Contractor inbox <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function JourneyProgress({ active, demo = false }: { active: number; demo?: boolean }) {
  const labels = demo ? ["Sample", "Sample overlays", "Quote"] : ["Budget", "Capture", "Review", "Estimate", "Send"];
  const currentLabel = labels[active - 1] ?? "Estimate";
  return (
    <>
      <nav className="mb-8 hidden grid-cols-5 gap-2 border-b border-slate-200 pb-4 md:grid" aria-label="Estimate steps">
        {labels.map((label, index) => {
          const step = index + 1;
          const done = step < active;
          const current = step === active;
          return (
            <div className="flex min-w-0 items-center gap-2 text-sm" key={label} aria-current={current ? "step" : undefined}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums ${done ? "border-emerald-700 bg-emerald-700 text-white" : current ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-300 bg-white text-slate-500"}`}>
                {done ? <Check size={14} aria-hidden="true" /> : `0${step}`}
              </span>
              <span className={`truncate ${current ? "font-semibold text-slate-900" : done ? "text-slate-700" : "text-slate-500"}`}>{label}</span>
            </div>
          );
        })}
      </nav>
      <div
        className="mb-4 grid gap-2 md:hidden"
        role="progressbar"
        aria-label="Estimate progress"
        aria-valuemin={1}
        aria-valuemax={labels.length}
        aria-valuenow={active}
        aria-valuetext={`Step ${active} of ${labels.length}: ${currentLabel}`}
      >
        <span className="text-sm font-semibold text-slate-800">Step {active} of {labels.length} · {currentLabel}</span>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-teal-800 transition-[width] duration-300" style={{ width: `${(active / labels.length) * 100}%` }} />
        </div>
      </div>
    </>
  );
}

export function PageFooter() {
  return (
    <footer className="wq-footer mt-10 border-t border-slate-200 pt-5 text-sm text-slate-600">
      <span>WalkQuote · Interior paint + minor drywall</span>
      <span>Preliminary range only. A contractor confirms scope and site conditions.</span>
    </footer>
  );
}
