import { motion, type HTMLMotionProps } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Check,
  CircleAlert,
  FileImage,
  LockKeyhole,
  Paintbrush,
  Ruler,
  Sparkles,
  Video,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { money } from "@/lib/pricing";

type BudgetChoice = {
  label: string;
  value: number | null;
};

interface BudgetSetupProps {
  motionProps: HTMLMotionProps<"section">;
  budgetAmount: number | null;
  budgetLabel: string;
  budgetIsCustom: boolean;
  budgetSliderValue: number;
  budgetChoices: readonly BudgetChoice[];
  videoCardImage: string;
  setupError: string;
  onChooseBudget: (amount: number | null, label: string) => void;
  onBudgetSliderChange: (value: string) => void;
  onContinue: () => void;
  onOpenDemoVideo: () => void;
}

export function BudgetSetup({
  motionProps,
  budgetAmount,
  budgetLabel,
  budgetIsCustom,
  budgetSliderValue,
  budgetChoices,
  videoCardImage,
  setupError,
  onChooseBudget,
  onBudgetSliderChange,
  onContinue,
  onOpenDemoVideo,
}: BudgetSetupProps) {
  return (
    <motion.section key="setup" className="space-y-7" {...motionProps}>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] lg:items-stretch">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-4 text-white shadow-xl sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-teal-400/20" />
          <div className="pointer-events-none absolute -right-4 -top-8 h-40 w-40 rounded-full border border-amber-300/20" />
          <div className="relative max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-300"><span className="h-px w-8 bg-teal-300" /> WalkQuote · one-room estimate</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.06] tracking-tight sm:mt-5 sm:text-6xl">See a first-pass painting range before the site visit.</h1>
            <p className="mt-3 max-w-2xl text-base leading-6 text-slate-300 sm:hidden">Compare a sample room’s selected work, first-pass range and target budget. Change the scope or target to see the match update.</p>
            <p className="mt-5 hidden max-w-2xl text-lg leading-8 text-slate-300 sm:block">An estimate delay can hold up a homeowner’s next decision. A contractor may spend a visit before the requested work and budget fit are clear. WalkQuote brings room details, selected scope, a preliminary range and a target budget into one view. In the sample, change optional work or the target and watch the match update.</p>
            <div className="mt-4 grid max-w-2xl gap-2 sm:mt-6 sm:flex sm:flex-wrap sm:gap-3">
              <Link to="/walkthrough" search={{ experience: "demo" }} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 py-3 text-base font-bold text-slate-950 shadow-lg shadow-amber-950/20 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 sm:w-auto sm:px-5"><Sparkles size={18} /> Explore Interactive Demo <ArrowRight size={17} /></Link>
              <button type="button" onClick={onContinue} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/5 px-3 py-3 text-base font-bold text-white transition hover:border-white/50 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto sm:px-5"><Camera size={18} /> Capture My Own Room (Live AI)</button>
            </div>
            <p className="mt-3 flex items-start gap-2 text-base leading-6 text-slate-300 sm:text-sm sm:leading-5"><LockKeyhole size={16} className="mt-0.5 shrink-0 text-amber-300" />The prepared sample opens without sign-in and creates no real room request. Live AI analysis is open to guests, up to 3 room runs per visitor per day.</p>
            <div className="mt-6 grid gap-2 border-t border-white/10 pt-4 sm:mt-8 sm:grid-cols-3 sm:gap-3 sm:pt-5">
              <div className="flex items-start gap-3"><Video size={19} className="mt-0.5 shrink-0 text-teal-300" /><span className="text-sm leading-5 text-slate-200">Video first<br /><strong className="text-white">About 30 seconds</strong></span></div>
              <div className="flex items-start gap-3"><FileImage size={19} className="mt-0.5 shrink-0 text-amber-300" /><span className="text-sm leading-5 text-slate-200">Photo fallback<br /><strong className="text-white">Three or four angles</strong></span></div>
              <div className="flex items-start gap-3"><Ruler size={19} className="mt-0.5 shrink-0 text-emerald-300" /><span className="text-sm leading-5 text-slate-200">Area review<br /><strong className="text-white">Wall area or doorway scale</strong></span></div>
            </div>
          </div>
        </div>
        <aside className="flex flex-col rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950">
            <img src={videoCardImage} alt="Static illustrative living-room sample image used in the video placeholder, not a recording" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/90 via-slate-950/40 to-slate-950/10" />
            <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
              <span className="rounded-full bg-slate-950/85 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-white">Sample still · not video</span>
              <span className="rounded-full bg-amber-300 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-950">Coming soon</span>
            </div>
            <div className="absolute bottom-4 left-4 right-4 text-white sm:bottom-5 sm:left-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-200">Room · scope · budget</p>
              <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">A three-minute product tour</p>
            </div>
          </div>
          <div className="mt-5 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">WalkQuote video walkthrough</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">See how the first-pass range comes together.</h2>
            <p className="mt-2 text-base leading-6 text-slate-600">The video has not been added yet. The interactive sample is ready now, with no sign-in.</p>
          </div>
          <button type="button" aria-haspopup="dialog" onClick={onOpenDemoVideo} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-900 transition hover:border-slate-500 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><Video size={18} aria-hidden="true" /> Watch 3-Minute Demo <ArrowRight size={17} aria-hidden="true" /></button>
        </aside>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="walkquote-story-heading">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Before the visit · a clearer first pass</p>
            <h2 id="walkquote-story-heading" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Give both sides something concrete to review.</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">A homeowner can spend hours chasing an estimate and still be unsure what the project can include. A contractor may arrive before both sides share the same scope or budget. WalkQuote brings the room note, selected work, a preliminary range and a target budget into one conversation. The sample lets you change the scope and see the match update; a contractor confirms real quantities, site conditions and final pricing.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">01 · Start with the room</span>
              <h3 className="mt-3 text-lg font-semibold text-slate-950">Show the work you want.</h3>
              <p className="mt-2 text-base leading-6 text-slate-600">Use a slow video walkthrough or three to four photos with a room note.</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">02 · Review a first pass</span>
              <h3 className="mt-3 text-lg font-semibold text-slate-950">See scope and range.</h3>
              <p className="mt-2 text-base leading-6 text-slate-600">Check the quantity basis and adjust optional work before the contractor confirms the room.</p>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-amber-900">03 · Compare the budget</span>
              <h3 className="mt-3 text-lg font-semibold text-slate-950">Watch the match respond.</h3>
              <p className="mt-2 text-base leading-6 text-slate-700">Change the sample target or scope and see the preliminary range update on screen.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="budget-heading">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">01 · Set a working budget</p>
            <h2 id="budget-heading" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">What would you like the work to stay near?</h2>
            <p className="mt-2 max-w-2xl text-base leading-6 text-slate-600">WalkQuote compares this target with the preliminary range. You can change it and trim optional work later.</p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-5 py-3 text-white sm:min-w-44">
            <span className="block text-xs font-bold uppercase tracking-[0.14em] text-slate-300">Working budget</span>
            <strong className="mt-1 block text-2xl tabular-nums">{budgetAmount === null ? "No target" : budgetIsCustom ? money(budgetAmount) : budgetLabel}</strong>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Choose a working budget">
          {budgetChoices.map((choice) => {
            const active = choice.value === null ? budgetAmount === null : budgetAmount === choice.value && !budgetIsCustom;
            return (
              <button key={choice.label} type="button" aria-pressed={active} onClick={() => onChooseBudget(choice.value, choice.label)} className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 text-base font-semibold transition ${active ? "border-teal-800 bg-teal-50 text-teal-950 ring-2 ring-teal-700/15" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"}`}>
                <span>{choice.label}</span>{active && <Check size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="mt-6">
          <label htmlFor="budget-slider" className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700"><span>Adjust your target</span><span className="tabular-nums text-slate-500">$500 to $5,000</span></label>
          <input id="budget-slider" type="range" min="500" max="5000" step="250" value={budgetSliderValue} onChange={(event) => onBudgetSliderChange(event.target.value)} aria-valuetext={budgetAmount === null ? "No target set" : money(budgetSliderValue)} className="mt-3 min-h-11 w-full cursor-pointer accent-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" />
          <div className="mt-1 flex justify-between text-xs font-medium tabular-nums text-slate-500"><span>$500</span><span>$5,000</span></div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center" aria-label="Start an estimate">
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-800 text-white"><Paintbrush size={21} /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-900">Supported project</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Interior painting + minor drywall</h2><p className="mt-1 text-sm leading-6 text-slate-700">One room per estimate. You choose the scope and confirm quantities.</p></div>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
          <button type="button" onClick={onContinue} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-teal-800 px-6 py-4 text-base font-bold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Start room walkthrough <ArrowRight size={18} /></button>
        </div>
      </section>
      {setupError && <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-900" role="alert"><CircleAlert size={17} />{setupError}</p>}
    </motion.section>
  );
}
