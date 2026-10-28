import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CircleAlert,
  FileImage,
  Home,
  Loader2,
  LockKeyhole,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Video,
} from "lucide-react";
import { RoomEstimate, User } from "@/entities";
import { analyzeRoom } from "@/functions";
import { money, moneyRange } from "@/lib/pricing";
import {
  BRAND_MARK,
  ROOMS,
  formatDimensionValue,
  measurementSourceLabel,
  roomMeasurementSummary,
} from "@/lib/walkquote-estimate";
import {
  createPrivateRoomMediaObjectUrl,
  loadPrivateRoomMediaAssets,
  PrivateRoomMediaError,
  revokePrivateRoomMediaObjectUrl,
} from "@/lib/private-room-media";
import { supabase } from "@/integrations/supabase/client";
import type { EstimateLead, UsageDiagnosticReply } from "@/types/estimate";
import { PageFooter } from "@/components/estimate/JourneyNav";

const USAGE_DIAGNOSTIC_FIELDS = ["id", "created_at", "status"] as const;
const INBOX_LIST_FIELDS = [
  "id",
  "created_at",
  "estimate_mode",
  "capture_mode",
  "sample_room",
  "sample_dimensions",
  "media_kind",
  "transcript",
  "visual_observations",
  "visible_door_count",
  "visible_window_count",
  "visible_mark_count",
  "wall_tone",
  "scale_reference",
  "measurement_source",
  "measurement_confidence",
  "room_shape",
  "room_length_ft",
  "room_width_ft",
  "room_perimeter_ft",
  "ceiling_height_ft",
  "wall_area_sqft",
  "gross_wall_area_sqft",
  "opening_deduction_sqft",
  "paintable_area_manually_edited",
  "ceiling_area_sqft",
  "trim_length_ft",
  "door_sides",
  "patch_count",
  "budget_label",
  "budget_amount",
  "selected_scope",
  "line_item_ranges",
  "estimate_assumptions",
  "subtotal_low",
  "subtotal_high",
  "tax_rate",
  "low_total",
  "high_total",
  "color_name",
  "color_hex",
  "contact_reference",
  "contact_name",
  "contact_phone",
  "zip_code",
  "status",
  "media_share_consent",
  "media_consent_at",
] as const;

function useStoredMediaUrl(base64?: string, mimeType = "application/octet-stream") {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!base64) {
      setUrl("");
      return;
    }
    let created = "";
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      created = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      setUrl(created);
    } catch {
      setUrl("");
    }
    return () => {
      if (created) URL.revokeObjectURL(created);
    };
  }, [base64, mimeType]);
  return url;
}

function StoredImage({ base64, alt, className = "" }: { base64: string; alt: string; className?: string }) {
  const url = useStoredMediaUrl(base64, "image/jpeg");
  return url ? <img src={url} alt={alt} className={className} loading="lazy" /> : <div className={`grid place-items-center bg-slate-100 text-slate-500 ${className}`}><FileImage size={22} /></div>;
}

function StoredVideo({ base64, mimeType }: { base64: string; mimeType?: string }) {
  const url = useStoredMediaUrl(base64, mimeType || "video/webm");
  return url ? (
    <video className="w-full rounded-xl bg-slate-950" controls playsInline preload="metadata" aria-label="Homeowner walkthrough video with spoken audio">
      <source src={url} type={mimeType || "video/webm"} />
      Your browser cannot play this video.
    </video>
  ) : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This saved video could not be opened in this browser.</p>;
}

function StoredAudio({ base64, mimeType }: { base64: string; mimeType?: string }) {
  const url = useStoredMediaUrl(base64, mimeType || "audio/webm");
  return url ? <audio controls src={url} className="w-full" aria-label="Homeowner spoken scope note" /> : <p className="text-sm text-amber-900">This audio note could not be opened in this browser.</p>;
}

export function ContractorInbox() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [access, setAccess] = useState<"checking" | "signed-out" | "not-admin" | "loading" | "ready" | "error">("checking");
  const [leads, setLeads] = useState<EstimateLead[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [inboxError, setInboxError] = useState("");
  const [expandedLeadId, setExpandedLeadId] = useState("");
  const [leadDetails, setLeadDetails] = useState<Record<string, EstimateLead>>({});
  const [leadMediaUrls, setLeadMediaUrls] = useState<Record<string, Record<string, string>>>({});
  const [detailLoadingId, setDetailLoadingId] = useState("");
  const [detailError, setDetailError] = useState("");
  const privateMediaUrlsRef = useRef(new Map<string, string[]>());
  const detailRequestTokenRef = useRef(new Map<string, number>());
  const [diagnosticBusy, setDiagnosticBusy] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<UsageDiagnosticReply | null>(null);
  const [diagnosticError, setDiagnosticError] = useState("");

  useEffect(() => () => {
    detailRequestTokenRef.current.forEach((token, leadId) => detailRequestTokenRef.current.set(leadId, token + 1));
    privateMediaUrlsRef.current.forEach((urls) => urls.forEach(revokePrivateRoomMediaObjectUrl));
    privateMediaUrlsRef.current.clear();
  }, []);

  const loadLeads = useCallback(async () => {
    setAccess("loading");
    setInboxError("");
    try {
      const query = (RoomEstimate as any).query().select([...INBOX_LIST_FIELDS]).sort("-created_at").limit(50);
      const response = await query.exec();
      const records = Array.isArray(response) ? response : response?.data;
      setLeads(Array.isArray(records) ? records as EstimateLead[] : []);
      setAccess("ready");
    } catch {
      setInboxError("The estimate inbox could not load. Refresh and try again.");
      setAccess("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const verifyAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (!session) {
          setAccess("signed-out");
          return;
        }
        const currentUser = await User.me();
        if (!active) return;
        if (!currentUser.isAdmin) {
          setAccess("not-admin");
          return;
        }
        setAdminEmail(currentUser.email ?? "");
        await loadLeads();
      } catch {
        if (active) setAccess("signed-out");
      }
    };
    void verifyAdmin();
    return () => { active = false; };
  }, [loadLeads]);

  const releaseLeadMediaUrls = (leadId: string) => {
    const urls = privateMediaUrlsRef.current.get(leadId) ?? [];
    urls.forEach(revokePrivateRoomMediaObjectUrl);
    privateMediaUrlsRef.current.delete(leadId);
    setLeadMediaUrls((current) => {
      if (!current[leadId]) return current;
      const next = { ...current };
      delete next[leadId];
      return next;
    });
  };

  const expandLead = async (lead: EstimateLead) => {
    if (expandedLeadId === lead.id) {
      detailRequestTokenRef.current.set(lead.id, (detailRequestTokenRef.current.get(lead.id) ?? 0) + 1);
      releaseLeadMediaUrls(lead.id);
      setExpandedLeadId("");
      setDetailLoadingId("");
      setDetailError("");
      return;
    }

    if (expandedLeadId && expandedLeadId !== lead.id) {
      detailRequestTokenRef.current.set(expandedLeadId, (detailRequestTokenRef.current.get(expandedLeadId) ?? 0) + 1);
      releaseLeadMediaUrls(expandedLeadId);
    }
    const requestToken = (detailRequestTokenRef.current.get(lead.id) ?? 0) + 1;
    detailRequestTokenRef.current.set(lead.id, requestToken);
    setExpandedLeadId(lead.id);
    setDetailError("");
    setDetailLoadingId(lead.id);

    try {
      const record = leadDetails[lead.id] ?? await RoomEstimate.get(lead.id) as EstimateLead;
      if (detailRequestTokenRef.current.get(lead.id) !== requestToken) return;
      if (!leadDetails[lead.id]) setLeadDetails((current) => ({ ...current, [lead.id]: record }));

      if (record.media_manifest && !privateMediaUrlsRef.current.has(lead.id)) {
        const blobs = await loadPrivateRoomMediaAssets(record.media_manifest);
        const urls: Record<string, string> = {};
        const createdUrls: string[] = [];
        try {
          blobs.forEach((blob, assetId) => {
            const url = createPrivateRoomMediaObjectUrl(blob);
            urls[assetId] = url;
            createdUrls.push(url);
          });
          if (detailRequestTokenRef.current.get(lead.id) !== requestToken) {
            createdUrls.forEach(revokePrivateRoomMediaObjectUrl);
            return;
          }
          privateMediaUrlsRef.current.set(lead.id, createdUrls);
          setLeadMediaUrls((current) => ({ ...current, [lead.id]: urls }));
        } catch (error) {
          createdUrls.forEach(revokePrivateRoomMediaObjectUrl);
          throw error;
        }
      }
    } catch (error) {
      if (detailRequestTokenRef.current.get(lead.id) === requestToken) {
        setDetailError(error instanceof PrivateRoomMediaError
          ? error.message
          : "The request media and full details could not load. Refresh the inbox and try again.");
      }
    } finally {
      if (detailRequestTokenRef.current.get(lead.id) === requestToken) setDetailLoadingId("");
    }
  };

  const runUsageDiagnostic = async () => {
    if (access !== "ready" || diagnosticBusy) return;
    setDiagnosticBusy(true);
    setDiagnosticError("");
    setDiagnosticResult(null);
    try {
      const result = await analyzeRoom({ operation: "diagnostic" }) as Partial<UsageDiagnosticReply> | null;
      if (typeof result?.ok !== "boolean" || typeof result.processMarker !== "string" || !/^[0-9a-f]{16}$/i.test(result.processMarker) || (result.connectionFingerprint !== null && (typeof result.connectionFingerprint !== "string" || !/^[0-9a-f]{24}$/i.test(result.connectionFingerprint)))) throw new Error("diagnostic-response-invalid");
      setDiagnosticResult({ ok: result.ok, processMarker: result.processMarker, connectionFingerprint: result.connectionFingerprint });
    } catch {
      setDiagnosticError("The server check could not be completed. Confirm you are signed in to the administrator account, then try again.");
    } finally {
      setDiagnosticBusy(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="wq-app min-h-screen">
      <header className="wq-header">
        <div className="wq-header-inner">
          <Link to="/" className="wq-brand" aria-label="WalkQuote home"><img className="wq-brand-mark" src={BRAND_MARK} alt="" /><span className="wq-brand-lockup"><span className="wq-brand-name">WalkQuote</span><span className="wq-brand-subtitle">Demo Painting Co. inbox</span></span></Link>
          <div className="wq-header-right"><span className="wq-demo-status"><LockKeyhole size={13} /> ADMIN-ONLY INBOX</span><Link className="wq-header-link" to="/">Homeowner estimate <ArrowUpRight size={15} /></Link></div>
        </div>
      </header>
      <main className="wq-main inbox-main pt-6 sm:pt-10">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-teal-800"><span className="h-px w-8 bg-teal-700" /> Demo Painting Co. · request desk</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Room estimate inbox</h1><p className="mt-2 max-w-2xl text-base leading-6 text-slate-600">Review homeowner media, approximate room quantities, scope, budget match, and color choices before arranging a site review.</p></div>
          {access === "ready" && <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{adminEmail}<button type="button" onClick={() => void logout()} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold hover:bg-slate-50">Sign out</button></div>}
        </div>

        {access === "checking" && <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-base font-medium text-slate-700"><Loader2 className="animate-spin" size={19} /> Checking account access…</div>}
        {access === "signed-out" && <div className="mx-auto mt-10 max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-800"><LockKeyhole size={23} /></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Administrator sign-in</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">Sign in to review room requests.</h2><p className="mt-3 text-base leading-7 text-slate-600">Homeowner contact details and submitted media are available only through the administrator inbox.</p><Link className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-base font-bold text-white hover:bg-teal-900" to="/login" search={{ from_url: "/contractor" }}>Sign in to the inbox <ArrowRight size={16} /></Link></div>}
        {access === "not-admin" && <div className="mx-auto mt-10 max-w-xl rounded-[2rem] border border-amber-200 bg-amber-50 p-7 text-center sm:p-10"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-900"><ShieldCheck size={23} /></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-amber-900">Restricted inbox</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">This view is reserved for the project administrator.</h2><p className="mt-3 text-base leading-7 text-slate-700">Estimate records remain hidden from this account.</p><Link className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800" to="/">Return to the homeowner estimate <ArrowRight size={16} /></Link></div>}
        {access === "loading" && <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-base font-medium text-slate-700"><Loader2 className="animate-spin" size={19} /> Loading protected estimate records…</div>}
        {access === "error" && <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-900 sm:flex-row sm:items-center"><CircleAlert size={18} /><span className="flex-1">{inboxError}</span><button className="min-h-11 rounded-xl border border-rose-300 bg-white px-4 py-2 font-semibold" type="button" onClick={() => void loadLeads()}>Retry</button></div>}

        {access === "ready" && (
          <>
            <section className="mt-6 grid gap-5 rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)] sm:p-6" aria-labelledby="usage-diagnostic-heading">
              <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-teal-800"><ShieldCheck size={15} /> Admin-only · no AI</p><h2 id="usage-diagnostic-heading" className="mt-2 text-xl font-semibold text-slate-950">Check the daily-limit safeguards</h2><p className="mt-2 text-sm leading-6 text-slate-600">This free check reads a short-lived storage probe and tests whether a stale update is rejected. It does not change estimate counts.</p><p className="mt-2 text-sm leading-6 text-slate-500">A passing result tests this request only. It cannot prove that every server process shares one counter store or that one network address represents one person.</p></div>
              <div className="flex flex-col justify-center gap-3"><button type="button" onClick={() => void runUsageDiagnostic()} disabled={diagnosticBusy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60">{diagnosticBusy ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={16} />}{diagnosticBusy ? "Testing storage…" : "Run no-cost check"}</button>{diagnosticError && <p className="text-sm text-rose-800" role="alert">{diagnosticError}</p>}{diagnosticResult && <div className={`rounded-xl p-3 text-sm ${diagnosticResult.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`} role="status"><strong>{diagnosticResult.ok ? "Counter test passed" : "Counter test failed"}</strong><p className="mt-1">Process {diagnosticResult.processMarker} · connection {diagnosticResult.connectionFingerprint ?? "unavailable"}</p></div>}</div>
            </section>

            <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 sm:p-5">
              <div><span className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Requests loaded</span><strong className="mt-1 block text-xl tabular-nums text-slate-950">{leads.length.toString().padStart(2, "0")}</strong></div>
              <div><span className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Estimate category</span><strong className="mt-1 block text-base text-slate-950">Interior paint + minor drywall</strong></div>
              <div className="flex items-center sm:justify-end"><button type="button" onClick={() => void loadLeads()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={15} /> Refresh inbox</button></div>
            </div>

            {leads.length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Home size={24} /></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">No requests yet</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">The next estimate request will appear here.</h2><p className="mx-auto mt-2 max-w-lg text-base leading-7 text-slate-600">Homeowners can send a room walkthrough or three to four photos with a preliminary painting scope and budget match.</p><Link to="/" className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-teal-900 hover:text-teal-700">Open homeowner estimate <ArrowUpRight size={15} /></Link></div>
            ) : (
              <div className="mt-6 space-y-4">
                {leads.map((lead, index) => {
                  const room = lead.sample_room === "living" ? ROOMS.living : lead.sample_room === "bedroom" ? ROOMS.bedroom : null;
                  const expanded = expandedLeadId === lead.id;
                  const detail = leadDetails[lead.id];
                  const privateMediaUrls = leadMediaUrls[lead.id];
                  const privateMediaAssets = detail?.media_manifest?.assets ?? [];
                  const privateVideoAsset = privateMediaAssets.find((asset) => asset.role === "walkthrough_video");
                  const privateVideoUrl = privateVideoAsset ? privateMediaUrls?.[privateVideoAsset.asset_id] : undefined;
                  const privatePhotoAssets = privateMediaAssets.filter((asset) => asset.role === "photo");
                  const privatePhotoMedia = privatePhotoAssets.flatMap((asset) => {
                    const url = privateMediaUrls?.[asset.asset_id];
                    return url ? [{ asset, url }] : [];
                  });
                  const privateFrameAssets = privateMediaAssets.filter((asset) => asset.role === "analysis_frame");
                  const privateFrameMedia = privateFrameAssets.flatMap((asset) => {
                    const url = privateMediaUrls?.[asset.asset_id];
                    return url ? [{ asset, url }] : [];
                  });
                  const privateSpokenNoteAsset = privateMediaAssets.find((asset) => asset.role === "spoken_note");
                  const privateSpokenNoteUrl = privateSpokenNoteAsset ? privateMediaUrls?.[privateSpokenNoteAsset.asset_id] : undefined;
                  const privatePrimaryRole = detail?.media_manifest?.primary_frame_role;
                  const privatePrimaryRoleAssets = privateMediaAssets.filter((asset) => asset.role === privatePrimaryRole);
                  const privatePrimaryIndex = detail?.media_manifest?.primary_frame_index ?? 0;
                  const privateCoverAsset = privatePrimaryRoleAssets[privatePrimaryIndex] ?? privatePhotoAssets[0] ?? privateFrameAssets[0];
                  const privateCoverUrl = privateCoverAsset ? privateMediaUrls?.[privateCoverAsset.asset_id] : undefined;
                  const protectedMediaMissing = Boolean(detail?.media_manifest && privateMediaAssets.some((asset) => !privateMediaUrls?.[asset.asset_id]));
                  const status = (lead.budget_amount ?? 0) <= 0 ? "Market price" : (lead.high_total ?? 0) <= (lead.budget_amount ?? 0) ? "Within budget" : (lead.low_total ?? 0) <= (lead.budget_amount ?? 0) ? "Close match" : "Over budget";
                  const detailIsHomeownerAreaOnly = detail?.measurement_source === "homeowner_entered_net_wall_area";
                  const detailHasAreaAudit = typeof detail?.gross_wall_area_sqft === "number";
                  const detailGrossWallArea = detailHasAreaAudit ? detail?.gross_wall_area_sqft : detailIsHomeownerAreaOnly ? null : typeof detail?.wall_area_sqft === "number" ? detail.wall_area_sqft : null;
                  const detailNetWallArea = detailIsHomeownerAreaOnly && typeof detail?.wall_area_sqft === "number"
                    ? detail.wall_area_sqft
                    : detailHasAreaAudit && typeof detail?.wall_area_sqft === "number" ? detail.wall_area_sqft : null;
                  const detailOpeningDeduction = typeof detail?.opening_deduction_sqft === "number" && detail.opening_deduction_sqft > 0 ? detail.opening_deduction_sqft : null;
                  const detailAreaWasManuallyEdited = !detailIsHomeownerAreaOnly && Boolean(detail?.paintable_area_manually_edited);
                  return (
                    <motion.article key={lead.id} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : index * 0.025 }} className="wq-inbox-record overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
                      <div className="wq-inbox-layout grid lg:grid-cols-[240px_minmax(0,1fr)]">
                        <div className="relative min-h-52 bg-slate-950 wq-lead-cover">
                          {room ? <img src={room.image} alt={room.alt} className="absolute inset-0 h-full w-full object-cover wq-lead-cover-image" loading="lazy" /> : privateCoverAsset && privateCoverUrl ? <img src={privateCoverUrl} alt={privateCoverAsset.role === "photo" ? "Homeowner-selected room photo" : "Representative frame from homeowner walkthrough"} className="absolute inset-0 h-full w-full object-cover wq-lead-cover-image" loading="lazy" /> : lead.media_kind === "photos" && detail?.photo_data_base64?.[0] ? <StoredImage base64={detail.photo_data_base64[0]} alt="First homeowner room photo" className="absolute inset-0 h-full w-full object-cover wq-lead-cover-image wq-lead-cover-fallback" /> : <div className="absolute inset-0 grid place-items-center bg-slate-900 text-slate-300 wq-lead-cover-fallback"><Video size={30} /></div>}
                          <span className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] ${lead.estimate_mode === "demo" ? "bg-amber-300 text-slate-950" : "bg-emerald-300 text-slate-950"}`}>{lead.estimate_mode === "demo" ? "Demo request" : "New request"}</span>
                        </div>
                        <div className="p-5 sm:p-6">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{room?.name ?? (lead.capture_mode === "video" ? "Walkthrough video" : "Room photos")} · {lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "New"}</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{lead.contact_name || "Homeowner request"}</h2><p className="mt-1 text-sm text-slate-600">{measurementSourceLabel(lead.measurement_source, lead.estimate_mode)} · {lead.measurement_confidence || "Quantity source not recorded"}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-sm font-bold ${status === "Within budget" ? "bg-emerald-100 text-emerald-900" : status === "Close match" ? "bg-amber-100 text-amber-950" : status === "Over budget" ? "bg-rose-100 text-rose-900" : "bg-slate-100 text-slate-800"}`}>{status}</span><strong className="text-xl tabular-nums text-slate-950">{moneyRange(lead.low_total ?? 0, lead.high_total ?? 0)}</strong></div></div>
                          <div className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-200 py-4 sm:grid-cols-4">
                            <div><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Budget</span><strong className="mt-1 block text-sm tabular-nums text-slate-900">{lead.budget_amount ? lead.budget_label || money(lead.budget_amount) : "Show market price"}</strong></div>
                            <div><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Room measurements</span><strong className="mt-1 block break-words text-sm leading-5 tabular-nums text-slate-900">{roomMeasurementSummary(lead)}</strong></div>
                            <div><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">ZIP</span><strong className="mt-1 block text-sm tabular-nums text-slate-900">{lead.zip_code || "Not provided"}</strong></div>
                            <div><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Color</span><strong className="mt-1 flex items-center gap-2 text-sm text-slate-900"><i className="h-4 w-4 rounded-full border border-slate-900/10" style={{ backgroundColor: lead.color_hex || "#d5dce0" }} />{lead.color_name || "Not selected"}</strong></div>
                          </div>
                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap gap-2"><a href={lead.contact_phone ? `tel:${lead.contact_phone}` : undefined} className={`lead-phone-link inline-flex min-h-12 w-full items-center gap-2 break-words rounded-lg px-4 py-3 text-base font-semibold sm:min-h-10 sm:w-auto sm:px-3 sm:py-2 sm:text-sm ${lead.contact_phone ? "bg-slate-100 text-slate-800 hover:bg-slate-200" : "bg-slate-50 text-slate-400"}`}><Phone size={17} />{lead.contact_phone || "Phone not provided"}</a><span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700"><MapPin size={15} />{lead.zip_code || "ZIP not provided"}</span></div>
                            <button type="button" onClick={() => void expandLead(lead)} disabled={Boolean(detailLoadingId && detailLoadingId !== lead.id)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{expanded ? "Hide request details" : "Review media and scope"}<ArrowRight size={15} className={expanded ? "rotate-90" : ""} /></button>
                          </div>
                          {expanded && <div className="mt-5 border-t border-slate-200 pt-5">
                            {detailLoadingId === lead.id ? <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Loader2 size={16} className="animate-spin" /> Loading original media and estimate detail…</p> : detailError ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900" role="alert">{detailError}</p> : detail ? <>
                              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                                <section className="space-y-4" aria-label="Submitted homeowner media">
                                  <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold text-slate-950">Submitted room media</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-600">Restricted estimate record</span></div>
                                  {detail.media_manifest ? <>
                                    {privateVideoAsset && privateVideoUrl ? <div className="rounded-xl border border-slate-200 bg-slate-950 p-2"><div className="flex items-center gap-2 px-2 pb-2 text-sm font-semibold text-white"><Video size={16} /> Original walkthrough video with recorded audio</div><video controls playsInline preload="metadata" src={privateVideoUrl} className="max-h-[32rem] w-full rounded-lg bg-black" aria-label="Homeowner walkthrough video with recorded audio">Your browser cannot play this walkthrough video.</video></div> : null}
                                    {privatePhotoMedia.length ? <div><p className="mb-2 text-sm font-semibold text-slate-700">Homeowner-selected room photos</p><div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4">{privatePhotoMedia.map(({ asset, url }, photoIndex) => <div key={asset.asset_id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={url} alt={`Homeowner room photo ${photoIndex + 1}`} className="block h-auto w-full object-contain" loading="lazy" /><p className="px-2 py-1.5 text-sm font-semibold text-slate-600">Photo {photoIndex + 1}</p></div>)}</div></div> : null}
                                    {privateFrameMedia.length ? <div><p className="mb-2 text-sm font-semibold text-slate-700">Representative video frames sent for visual analysis</p><div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4">{privateFrameMedia.map(({ asset, url }, frameIndex) => <div key={asset.asset_id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950"><img src={url} alt={`Representative video frame ${frameIndex + 1}`} className="block h-auto w-full object-contain" loading="lazy" /><p className="px-2 py-1.5 text-sm font-semibold text-slate-200">Frame {frameIndex + 1}</p></div>)}</div></div> : null}
                                    {privateSpokenNoteUrl && privateSpokenNoteAsset ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="mb-2 text-sm font-semibold text-slate-800">Separate spoken note for photo submission</p><audio controls preload="metadata" src={privateSpokenNoteUrl} className="w-full" aria-label="Homeowner spoken room note">Your browser cannot play this spoken note.</audio></div> : null}
                                    {protectedMediaMissing && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900" role="alert">One or more protected media files could not be opened. Close and reopen this request to retry. If the files remain unavailable, ask the project administrator to review the request.</p>}
                                    {!privateMediaAssets.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">This protected request has no media assets listed.</p>}
                                  </> : <>
                                    {detail.video_data_base64 ? <><p className="text-sm leading-5 text-slate-600">Original walkthrough video, including spoken audio.</p><StoredVideo base64={detail.video_data_base64} mimeType={detail.media_mime_type} /></> : null}
                                    {detail.photo_data_base64?.length ? <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4">{detail.photo_data_base64.map((photo, photoIndex) => <div key={`${lead.id}-photo-${photoIndex}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><StoredImage base64={photo} alt={`Homeowner room photo ${photoIndex + 1}`} className="block h-auto w-full object-contain" /><p className="px-2 py-1.5 text-sm font-semibold text-slate-600">Photo {photoIndex + 1}</p></div>)}</div> : null}
                                    {detail.analysis_frame_data_base64?.length ? <div><p className="mb-2 text-sm font-semibold text-slate-700">Representative analysis frames</p><div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4">{detail.analysis_frame_data_base64.map((frame, frameIndex) => <StoredImage key={`${lead.id}-frame-${frameIndex}`} base64={frame} alt={`Representative video frame ${frameIndex + 1}`} className="block h-auto w-full rounded-xl border border-slate-200 object-contain bg-slate-950" />)}</div></div> : null}
                                    {detail.audio_note_data_base64 ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="mb-2 text-sm font-semibold text-slate-800">Spoken note for photo submission</p><StoredAudio base64={detail.audio_note_data_base64} mimeType={detail.audio_note_mime_type} /></div> : null}
                                    {!detail.video_data_base64 && !detail.photo_data_base64?.length && !detail.analysis_frame_data_base64?.length && !detail.audio_note_data_base64 && room && <img src={room.image} alt={room.alt} className="w-full rounded-xl" />}
                                    {!detail.video_data_base64 && !detail.photo_data_base64?.length && !detail.analysis_frame_data_base64?.length && !detail.audio_note_data_base64 && !room && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No homeowner media was attached to this record.</p>}
                                  </>}
                                </section>
                                <section className="space-y-4" aria-label="Estimate analysis details">
                                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <h3 className="font-semibold text-slate-950">Approximate quantities</h3>
                                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                      <div className="col-span-2"><dt className="text-slate-500">{detailIsHomeownerAreaOnly ? "Quantity basis" : "Room shape and size basis"}</dt><dd className="mt-1 font-semibold leading-5 tabular-nums text-slate-950">{roomMeasurementSummary(detail)}</dd></div>
                                      <div className="col-span-2"><dt className="text-slate-500">Estimation source</dt><dd className="mt-1 font-semibold leading-5 text-slate-950">{measurementSourceLabel(detail.measurement_source, detail.estimate_mode)}</dd></div>
                                      <div><dt className="text-slate-500">Gross wall area</dt><dd className="mt-1 font-semibold tabular-nums text-slate-950">{typeof detailGrossWallArea === "number" ? `${formatDimensionValue(detailGrossWallArea)} sq ft` : "Not recorded"}</dd></div>
                                      <div><dt className="text-slate-500">Opening deduction</dt><dd className="mt-1 font-semibold tabular-nums text-slate-950">{detailIsHomeownerAreaOnly ? "Not calculated separately" : detailOpeningDeduction !== null ? `−${formatDimensionValue(detailOpeningDeduction)} sq ft` : "Not deducted"}</dd></div>
                                      <div><dt className="text-slate-500">Paintable wall area · net</dt><dd className="mt-1 font-semibold tabular-nums text-slate-950">{typeof detailNetWallArea === "number" ? `${formatDimensionValue(detailNetWallArea)} sq ft${detailAreaWasManuallyEdited ? " · edited" : ""}` : "Not recorded separately"}</dd></div>
                                      <div><dt className="text-slate-500">Ceiling area</dt><dd className="mt-1 font-semibold tabular-nums text-slate-950">{typeof detail.ceiling_area_sqft === "number" ? `${formatDimensionValue(detail.ceiling_area_sqft)} sq ft` : detailIsHomeownerAreaOnly ? "Not recorded · unpriced" : "Not recorded"}</dd></div>
                                      <div><dt className="text-slate-500">Room perimeter</dt><dd className="mt-1 font-semibold tabular-nums text-slate-950">{typeof detail.room_perimeter_ft === "number" ? `${formatDimensionValue(detail.room_perimeter_ft)} ft` : typeof detail.trim_length_ft === "number" ? `${formatDimensionValue(detail.trim_length_ft)} ft` : detailIsHomeownerAreaOnly ? "Not recorded · unpriced" : "Not recorded"}</dd></div>
                                      <div><dt className="text-slate-500">Door sides · patch spots</dt><dd className="mt-1 font-semibold tabular-nums text-slate-950">{detail.door_sides ?? "Not included"} · {detail.patch_count ?? "Not included"}</dd></div>
                                      <div><dt className="text-slate-500">Paintable area manually edited</dt><dd className="mt-1 font-semibold text-slate-950">{detailIsHomeownerAreaOnly ? "Not applicable · area entered directly" : detail.paintable_area_manually_edited ? "Yes" : detailHasAreaAudit ? "No" : "Not recorded"}</dd></div>
                                    </dl>
                                    <p className="mt-3 text-xs leading-5 text-slate-500">{detailIsHomeownerAreaOnly ? `${detail.measurement_confidence || "Homeowner-entered net wall-area approximation."} No separate gross area or opening deduction was calculated.` : `${detail.measurement_confidence || "Illustrative values"}. ${detailHasAreaAudit ? detailOpeningDeduction !== null ? "The listed opening deduction was subtracted from gross area before pricing, unless the homeowner later edited net paintable area." : "No supported opening deduction was recorded, so none was subtracted." : "Older estimates store wall area as a gross quantity and do not separately record net paintable area or opening deductions."}`}</p>
                                  </div>
                                  {detail.line_item_ranges?.length ? <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-950">Included line-item ranges</h3><ul className="mt-3 space-y-2">{detail.line_item_ranges.map((line, lineIndex) => <li key={`${line}-${lineIndex}`} className="text-sm leading-5 text-slate-700">{line}</li>)}</ul></div> : null}
                                  {detail.estimate_assumptions?.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">Estimate assumptions</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-amber-950">{detail.estimate_assumptions.map((assumption, assumptionIndex) => <li key={`${assumption}-${assumptionIndex}`}>{assumption}</li>)}</ul></div> : null}
                                  {detail.visual_observations?.length ? <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-950">Visible observations</h3><ul className="mt-2 space-y-1 text-sm leading-5 text-slate-700">{detail.visual_observations.map((observation, observationIndex) => <li key={`${observation}-${observationIndex}`}>• {observation}</li>)}</ul></div> : null}
                                  {detail.transcript && <div className="rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Redacted room transcript</h3><p className="mt-2 text-sm leading-6 text-slate-800">“{detail.transcript}”</p></div>}
                                  <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><p className="flex items-center gap-2 font-semibold"><BadgeCheck size={16} /> Media sharing consent</p><p className="mt-1">{detail.media_share_consent ? `Recorded ${detail.media_consent_at ? new Date(detail.media_consent_at).toLocaleString() : "with request"}.` : "No media-sharing consent is recorded."}</p></div>
                                </section>
                              </div>
                            </> : null}
                          </div>}
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </>
        )}
        <PageFooter />
      </main>
    </div>
  );
}
