import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Cpu, FileText, Palette, ScanLine, Video } from "lucide-react";
import { HeroHeader, PageFooter } from "@/components/estimate/JourneyNav";
import { BRAND_MARK, LIVING_ROOM_IMAGE } from "@/lib/walkquote-estimate";

const STEPS = [
  { icon: Video, title: "Walk & Record Room", detail: "Record a slow 30-second tour on your phone, or upload a video or 3–4 photos you already have." },
  { icon: ScanLine, title: "Instant Multimodal Assessment", detail: "Muse Spark reads wall area, doors and windows, and prep work. SAM 3.1 outlines the walls, trim and openings." },
  { icon: FileText, title: "Live Color Preview & Itemized PDF Quote", detail: "Try any wall color with a before/after slider, then get an itemized quote you can download or send." },
] as const;

const MODELS = ["Muse Spark 1.3", "SAM 3.1", "Muse Voice"];

function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay } });
  return (
    <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:py-20">
      <div>
        <motion.span {...rise(0)} data-testid="hackathon-pill" className="inline-flex flex-wrap items-center gap-2 rounded-2xl sm:rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-teal-900">
          <Cpu size={14} aria-hidden="true" /> Built on Meta Model API · {MODELS.join(" · ")}
        </motion.span>
        <motion.h1 {...rise(0.08)} data-testid="landing-hero-title" className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
          Instant Interior Painting Estimates from a 30-Second Room Walk.
        </motion.h1>
        <motion.p {...rise(0.16)} className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
          WalkQuote uses Meta AI to look at your room the way a painter would. Muse Spark reviews your video, photos and spoken notes together, and SAM 3.1 picks out the walls, trim and openings, so you get a believable price range and a real color preview in about a minute.
        </motion.p>
        <motion.div {...rise(0.24)} className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link to="/walkthrough" data-testid="landing-start-walkthrough-btn" className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-teal-800 px-7 py-4 text-base font-bold text-white shadow-lg shadow-teal-900/20 transition-colors hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
            Start Walkthrough <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link to="/contractor" search={{ view: "demo" }} data-testid="landing-contractor-demo-btn" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-7 py-4 text-base font-semibold text-slate-800 transition-colors hover:border-slate-500 hover:bg-slate-50">
            View Contractor Demo
          </Link>
        </motion.div>
        <p className="mt-5 text-sm text-slate-500">No sign-up needed. Your video stays on your device until you choose to send a request.</p>
      </div>
      <HeroVisual />
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative" data-testid="landing-hero-visual">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/10">
        <img src={LIVING_ROOM_IMAGE} alt="Living room with walls ready for a new paint color" className="block aspect-[4/3] w-full object-cover" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-teal-500/35 mix-blend-multiply" aria-hidden="true" />
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white" aria-hidden="true" />
        <div className="absolute inset-x-4 top-4 flex justify-between text-xs font-bold uppercase tracking-[0.12em] text-white">
          <span className="rounded-full bg-slate-950/70 px-3 py-1.5">Original Room</span>
          <span className="rounded-full bg-slate-950/70 px-3 py-1.5">Color Preview</span>
        </div>
      </div>
      <div className="absolute -bottom-6 left-4 right-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:left-8 sm:right-auto">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800"><Palette size={20} aria-hidden="true" /></span>
        <div><p className="text-sm font-bold text-slate-950">Sample living room · 2 coats</p><p className="text-sm tabular-nums text-slate-600">Example range $1,180 – $1,520</p></div>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="how-it-works-title" data-testid="how-it-works">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">How it works</p>
      <h2 id="how-it-works-title" className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">From a quick room tour to a quote you can trust.</h2>
      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, detail }, index) => (
          <li key={title} data-testid={`how-it-works-step-${index + 1}`} className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm transition-transform duration-200 hover:-translate-y-1 sm:p-7">
            <div className="flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-teal-300"><Icon size={22} aria-hidden="true" /></span>
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-400">0{index + 1}</span>
            </div>
            <h3 className="mt-6 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-2 text-base leading-7 text-slate-600">{detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="mb-6 flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-slate-950 p-8 text-white sm:p-10 md:flex-row md:items-center">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to see your room in a new color?</h2>
        <p className="mt-2 text-base text-slate-300">Record, upload a video, or add a few photos. It takes about a minute.</p>
      </div>
      <Link to="/walkthrough" data-testid="landing-bottom-start-btn" className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-teal-400 px-7 py-4 text-base font-bold text-slate-950 transition-colors hover:bg-teal-300">
        Start Walkthrough <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]" data-testid="landing-page">
      <HeroHeader brandMark={BRAND_MARK} landing />
      <main className="mx-auto w-[min(100%-36px,1220px)]">
        <Hero />
        <HowItWorks />
        <ClosingCta />
        <PageFooter />
      </main>
    </div>
  );
}
