import { useState } from "react";
import { Pencil } from "lucide-react";
import { DOOR_OPENING_SQFT, WINDOW_OPENING_SQFT, type OpeningCrossCheck } from "@/lib/room-sizes";
import type { RoomAssessment } from "@/types/estimate";

type SizeKey = "lengthFt" | "widthFt" | "ceilingHeightFt";
type CountKey = "visibleDoorCount" | "visibleWindowCount";
type OpeningKind = "doors" | "windows";

interface RoomSizeAdjusterProps {
  fields: Record<SizeKey, string>;
  assessment: RoomAssessment;
  onFieldChange: (key: SizeKey, value: string) => void;
  onAdjustCount?: (key: CountKey, delta: number) => void;
  openingChecks?: Record<OpeningKind, OpeningCrossCheck>;
}

const SIZE_FIELDS: Array<[SizeKey, string]> = [["lengthFt", "Length"], ["widthFt", "Width"], ["ceilingHeightFt", "Ceiling"]];
const COUNT_FIELDS: Array<[CountKey, string, number, OpeningKind]> = [
  ["visibleDoorCount", "Doors", DOOR_OPENING_SQFT, "doors"],
  ["visibleWindowCount", "Windows", WINDOW_OPENING_SQFT, "windows"],
];

export function RoomSizeAdjuster({ fields, assessment, onFieldChange, onAdjustCount, openingChecks }: RoomSizeAdjusterProps) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<SizeKey, string>>>({});
  // Only valid sizes reach the estimate, so a half-typed value never blanks the quote.
  const changeSize = (key: SizeKey, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
    const number = Number(value);
    const max = key === "ceilingHeightFt" ? 20 : 60;
    if (value.trim() && Number.isFinite(number) && number >= 1 && number <= max) onFieldChange(key, value);
  };
  const suggested = assessment.suggestedDimensions;
  return (
    <div className="mt-3 rounded-xl bg-white/5 p-4" data-testid="room-size-adjuster">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Room size &amp; openings{suggested?.confidence === "low" ? " · rough estimate" : ""}</span>
        <button type="button" data-testid="room-size-edit-toggle" onClick={() => setOpen((value) => !value)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-teal-200 underline decoration-teal-200/60 underline-offset-2 hover:text-white"><Pencil size={13} aria-hidden="true" />{open ? "Done" : "Adjust room size"}</button>
      </div>
      {suggested?.basis && <p className="mt-2 text-xs leading-5 text-slate-400" data-testid="room-size-basis">{suggested.basis}</p>}
      {open && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {SIZE_FIELDS.map(([key, label]) => (
            <label key={key} className="block text-xs font-semibold text-slate-300">
              {label} (ft)
              <input data-testid={`room-size-${key}`} type="number" min="1" max="60" step="0.5" inputMode="decimal" value={drafts[key] ?? fields[key]} onChange={(event) => changeSize(key, event.target.value)} onBlur={() => setDrafts((current) => ({ ...current, [key]: undefined }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-base font-semibold tabular-nums text-slate-950 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-300" />
            </label>
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {COUNT_FIELDS.map(([key, label, each, kind]) => (
          <div key={key} className="rounded-lg border border-white/10 p-2">
            <span className="block text-xs text-slate-400">{label} · −{each} sq ft each</span>
            <div className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums text-white">
              <button type="button" data-testid={`estimate-${key}-minus`} aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onAdjustCount?.(key, -1)} className="h-9 w-9 rounded-lg border border-white/20 hover:bg-white/10">−</button>
              <span data-testid={`estimate-${key}-value`} className="min-w-6 text-center">{assessment[key] ?? 0}</span>
              <button type="button" data-testid={`estimate-${key}-plus`} aria-label={`More ${label.toLowerCase()}`} onClick={() => onAdjustCount?.(key, 1)} className="h-9 w-9 rounded-lg border border-white/20 hover:bg-white/10">+</button>
            </div>
            <OpeningCheckNote kind={kind} check={openingChecks?.[kind]} current={assessment[key] ?? 0} onApply={(delta) => onAdjustCount?.(key, delta)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function OpeningCheckNote({ kind, check, current, onApply }: { kind: OpeningKind; check?: OpeningCrossCheck; current: number; onApply: (delta: number) => void }) {
  if (!check || check.status === "unavailable") return null;
  if (check.status === "agree") {
    return <p data-testid={`sam-check-${kind}-ok`} className="mt-1.5 text-[11px] leading-4 text-emerald-300">SAM 3.1 agrees</p>;
  }
  const range = check.samMin === check.samMax ? `${check.samMin}` : `${check.samMin}–${check.samMax}`;
  return (
    <div data-testid={`sam-check-${kind}-flag`} role="status" className="mt-1.5 rounded-md bg-amber-400/15 p-1.5 text-[11px] leading-4 text-amber-100">
      SAM 3.1 sees {range} {kind}. Muse Spark counted {current}.
      {check.suggested !== null && check.suggested !== current && (
        <button type="button" data-testid={`sam-check-${kind}-apply`} onClick={() => onApply((check.suggested ?? current) - current)} className="ml-1 font-bold underline underline-offset-2 hover:text-white">Use {check.suggested}</button>
      )}
    </div>
  );
}
