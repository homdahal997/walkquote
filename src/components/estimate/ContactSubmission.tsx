import type { FormEvent } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  LockKeyhole,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { money, moneyRange, PRICE_BOOK } from "@/lib/pricing";
import type { statusForBudget } from "@/lib/pricing";
import type { CapturedVideoAsset, CaptureMode, PaintColor, RoomDimensions, ScopeLine, Screen } from "@/types/estimate";
import type { RoomImageAsset } from "@/lib/room-media";
import type { QuoteTotals } from "@/types/estimate";

export interface ContactSubmissionState {
  mode: "homeowner" | "demo";
  dimensions: RoomDimensions | null;
  measurementConfirmed: boolean;
  sampleRoomName: string | null;
  captureMode: CaptureMode;
  primaryImageUrl: string;
  primaryImageAlt: string;
  videoAsset: CapturedVideoAsset | null;
  photoAssets: RoomImageAsset[];
  totals: QuoteTotals;
  budgetStatus: ReturnType<typeof statusForBudget>;
  budgetAmount: number | null;
  budgetIsCustom: boolean;
  budgetLabel: string;
  color: PaintColor;
  includedItems: ScopeLine[];
  name: string;
  phone: string;
  zipCode: string;
  mediaShareConsent: boolean;
  formError: string;
  submitting: boolean;
}

export interface ContactSubmissionHandlers {
  setScreen: (screen: Screen) => void;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onZipCodeChange: (value: string) => void;
  onMediaShareConsentChange: (checked: boolean) => void;
  onSubmitLead: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  resetFlow: () => void;
}

export interface ContactSubmissionProps {
  screen: "contact" | "complete";
  motionProps: HTMLMotionProps<"section">;
  state: ContactSubmissionState;
  handlers: ContactSubmissionHandlers;
}

export function ContactSubmission({ screen, motionProps, state, handlers }: ContactSubmissionProps) {
  const {
    mode,
    dimensions,
    measurementConfirmed,
    sampleRoomName,
    captureMode,
    primaryImageUrl,
    primaryImageAlt,
    videoAsset,
    photoAssets,
    totals,
    budgetStatus,
    budgetAmount,
    budgetIsCustom,
    budgetLabel,
    color,
    includedItems,
    name,
    phone,
    zipCode,
    mediaShareConsent,
    formError,
    submitting,
  } = state;
  const {
    setScreen,
    onNameChange,
    onPhoneChange,
    onZipCodeChange,
    onMediaShareConsentChange,
    onSubmitLead,
    resetFlow,
  } = handlers;

  if (screen === "contact") {
    if (mode !== "homeowner" || !dimensions || !measurementConfirmed) return null;
    const selectedLabels = includedItems.map((item) => item.label);
    return (
      <motion.section key="contact" className="space-y-6" {...motionProps}>
        <div>
          <button type="button" onClick={() => setScreen("estimate")} className="mb-4 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-slate-700 hover:text-slate-950"><ArrowLeft size={17} /> Back to estimate</button>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">05 · Send to Demo Painting Co.</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Share the scope and room tour.</h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">The contractor receives your estimate, budget, color choice, and the media you selected, so they can review the room before arranging a visit.</p>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
          <aside className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
            {mode === "demo" ? primaryImageUrl && <img src={primaryImageUrl} alt={primaryImageAlt} className="aspect-video w-full object-cover" /> : captureMode === "video" && videoAsset ? <video src={videoAsset.previewUrl} controls playsInline className="aspect-video w-full bg-slate-950 object-contain" aria-label="Your room walkthrough preview" /> : photoAssets[0] ? <img src={photoAssets[0].previewUrl} alt="First selected room photo" className="block h-auto w-full object-contain" /> : null}
            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Estimate range</p><strong className="mt-1 block text-xl tabular-nums text-slate-950">{moneyRange(totals.low, totals.high)}</strong></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${budgetStatus === "within" ? "bg-emerald-100 text-emerald-900" : budgetStatus === "close" ? "bg-amber-100 text-amber-950" : budgetStatus === "over" ? "bg-rose-100 text-rose-900" : "bg-slate-100 text-slate-800"}`}>{budgetStatus === "within" ? "Within budget" : budgetStatus === "close" ? "Close match" : budgetStatus === "over" ? "Over budget" : "Market range"}</span></div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm"><span className="text-slate-600">Working budget</span><strong className="tabular-nums text-slate-950">{budgetAmount === null ? "Show market price" : budgetIsCustom ? money(budgetAmount) : budgetLabel}</strong></div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm"><span className="text-slate-600">Wall color</span><strong className="flex items-center gap-2 text-slate-950"><i className="h-5 w-5 rounded-full border border-slate-900/10" style={{ backgroundColor: color.hex }} />{color.name} <span className="text-xs font-normal text-slate-500">{color.hex.toUpperCase()}</span></strong></div>
              <div className="border-t border-slate-200 pt-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Included scope</p><ul className="mt-2 space-y-2">{selectedLabels.map((label) => <li key={label} className="flex items-start gap-2 text-sm text-slate-800"><Check size={15} className="mt-0.5 shrink-0 text-emerald-700" />{label}</li>)}</ul></div>
              <p className="rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-950">Preliminary range only. The contractor confirms room size, scope, local pricing, and site conditions.</p>
            </div>
          </aside>

          <form onSubmit={onSubmitLead} noValidate className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-800"><UserRound size={21} /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Contact details</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">Who should the painter call?</h2></div></div>
            <p className="mt-3 text-sm leading-6 text-slate-600">Name, phone, and ZIP go to Demo Painting Co. so the contractor can review the request and call you. The contact details you enter here stay out of model prompts.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">Your name<div className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/20"><UserRound size={17} className="shrink-0 text-slate-500" /><input name="name" autoComplete="name" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="First and last name" className="h-11 w-full bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400" /></div></label>
              <div className="block text-sm font-semibold text-slate-800 sm:col-span-2"><label htmlFor="homeowner-phone">Phone number</label><div className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/20"><Phone size={17} className="shrink-0 text-slate-500" /><PhoneInput id="homeowner-phone" defaultCountry="US" international countryCallingCodeEditable={false} value={phone || undefined} onChange={(value) => onPhoneChange(value ?? "")} aria-label="Phone number" autoComplete="tel" placeholder="(555) 123-4567" className="w-full" /></div></div>
              <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">ZIP code<div className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/20"><MapPin size={17} className="shrink-0 text-slate-500" /><input name="postal-code" autoComplete="postal-code" inputMode="numeric" maxLength={10} value={zipCode} onChange={(event) => onZipCodeChange(event.target.value.replace(/[^0-9-]/g, ""))} placeholder="e.g. 94110" className="h-11 w-full bg-transparent text-base tabular-nums text-slate-950 outline-none placeholder:text-slate-400" /></div><small className="mt-1 block font-normal text-slate-500">Helps the contractor check the service area.</small></label>
            </div>
            <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-teal-950"><input type="checkbox" checked={mediaShareConsent} onChange={(event) => onMediaShareConsentChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-teal-800" /><span><strong>I agree to share my estimate, room transcript with common phone, email, ZIP, and street-address patterns redacted, selected scope, budget, color choice, and selected media with Demo Painting Co. for review.</strong> The original video, including its recorded audio, or my selected photos and any separate spoken note will be stored with this request for contractor review. Four selected video frames or my photos support visual analysis, and recorded voice audio is sent for transcription. My name, phone, and ZIP are shared with the contractor for follow-up and stay out of model prompts. The media is kept in protected administrator-only records, not public file links.</span></label>
            </div>
            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600"><LockKeyhole size={16} className="mt-0.5 shrink-0 text-teal-800" />The contact integration stores your name and phone. ZIP and estimate details stay with the administrator-only request.</p>
            {formError && <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-900" role="alert"><CircleAlert size={17} className="mt-0.5 shrink-0" />{formError}</p>}
            <div className="mt-6 border-t border-slate-200 pt-5">
              <button type="submit" disabled={submitting} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-4 text-base font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">{submitting ? <><Loader2 size={17} className="animate-spin" /> Sending request</> : <>Send estimate to Demo Painting Co. <ArrowRight size={17} /></>}</button>
              <p className="mt-3 text-center text-sm leading-5 text-slate-500">By sending, you ask Demo Painting Co. to review this estimate and contact you by phone.</p>
            </div>
          </form>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section key="complete" className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-xl sm:p-10" {...motionProps}>
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><Check size={30} /></div>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Request saved · Demo Painting Co.</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Your room estimate is ready for contractor review.</h1>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">The request includes your selected scope, budget match, color choice, approximate room quantities, and the media you agreed to share. Demo Painting Co. can review it in the administrator-only inbox.</p>
      <div className="mt-7 grid gap-3 rounded-2xl bg-slate-50 p-4 text-left sm:grid-cols-3 sm:p-5">
        <div><span className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Project</span><strong className="mt-1 block text-base text-slate-950">{mode === "demo" ? `${sampleRoomName ?? "Sample room"} · demo` : "Interior paint + drywall"}</strong></div>
        <div><span className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Range</span><strong className="mt-1 block text-base tabular-nums text-slate-950">{moneyRange(totals.low, totals.high)}</strong></div>
        <div><span className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Wall color</span><strong className="mt-1 flex items-center gap-2 text-base text-slate-950"><i className="h-5 w-5 rounded-full border border-slate-900/10" style={{ backgroundColor: color.hex }} />{color.name}</strong></div>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-600">The range uses the supplied price book and an {PRICE_BOOK.taxAndConsumables.label} planning assumption. The contractor confirms surface conditions, local pricing, and final scope.</p>
      <button type="button" onClick={resetFlow} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-base font-bold text-white transition hover:bg-slate-800">Start another estimate <RefreshCw size={16} /></button>
    </motion.section>
  );
}
