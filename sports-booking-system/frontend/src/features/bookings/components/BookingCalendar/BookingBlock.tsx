import clsx from "clsx";
import { Flame, Lock, LockKeyholeOpen, Sparkles, Wrench, X } from "lucide-react";
import type { WeeklyScheduleSlot } from "../../../../types/api";
import { formatCurrency } from "../../../../lib/format";
import { isSlotSelectable, predictionAccent, predictionLabel, statusLabel, type Language } from "./utils";

export type BookingBlockProps = {
  slot: WeeklyScheduleSlot | undefined;
  selected?: boolean;
  onToggle?: (slot: WeeklyScheduleSlot) => void;
  language: Language;
  showTooltip?: boolean;
  /**
   * Staff-only: lets clicking a BOOKED/BLOCKED slot open a management action
   * (check-in/out, lock/unlock) instead of leaving it permanently disabled.
   * Off by default so the customer-facing calendar is unaffected.
   */
  manageable?: boolean;
  onManage?: (slot: WeeklyScheduleSlot) => void;
};

export function BookingBlock({ slot, selected, onToggle, language, showTooltip = true, manageable, onManage }: BookingBlockProps) {
  if (!slot) {
    return <div className="border-b border-l border-slate-100" aria-hidden />;
  }

  const manageableStatus = manageable && Boolean(onManage) && (slot.status === "BOOKED" || slot.status === "BLOCKED");
  const interactive = (isSlotSelectable(slot) && Boolean(onToggle)) || manageableStatus;

  const classes = clsx(
    "absolute inset-0 select-none px-1.5 py-1 text-left text-[11px] font-bold transition-all duration-150",
    interactive && "cursor-pointer hover:-translate-y-px",
    !interactive && "cursor-not-allowed",
    slot.status === "AVAILABLE" && !selected && "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    selected && "bg-emerald-600 text-white shadow-inner ring-2 ring-emerald-700/40",
    slot.status === "BOOKED" && "bg-rose-50 text-rose-700",
    slot.status === "BLOCKED" && "bg-slate-100 text-slate-500",
    slot.status === "MAINTENANCE" && "bg-amber-50 text-amber-800",
    slot.status === "OUTSIDE_HOURS" && "bg-slate-50 text-slate-300",
    slot.status === "HELD" && "bg-yellow-50 text-yellow-700"
  );

  const Icon =
    slot.status === "BOOKED"
      ? Lock
      : slot.status === "MAINTENANCE"
        ? Wrench
        : slot.status === "BLOCKED"
          ? X
          : null;

  const peak =
    slot.status === "AVAILABLE" && slot.predictionLevel && slot.predictionStatus === "GENERATED"
      ? predictionAccent(slot.predictionLevel)
      : null;

  const peakAccent =
    slot.status === "AVAILABLE" && slot.predictionLevel === "VERY_HIGH" && slot.predictionStatus === "GENERATED";

  return (
    <div className="group relative h-12 border-l border-b border-slate-100">
      <button
        type="button"
        onClick={interactive ? () => (manageableStatus ? onManage!(slot) : onToggle!(slot)) : undefined}
        disabled={!interactive}
        className={classes}
        aria-label={`${slot.startTime}-${slot.endTime} ${slot.status}`}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className={clsx("font-black leading-none", selected ? "text-white" : "text-current")}>
              {slot.startTime}
            </span>
            {Icon ? <Icon className="h-3.5 w-3.5 opacity-80" /> : null}
          </div>
          <div className="flex items-center justify-between gap-1">
            {Icon ? (
              <span className="truncate text-[10px] font-black uppercase tracking-wide">
                {statusLabel(slot.status, language)}
              </span>
            ) : (
              <span
                className={clsx(
                  "truncate font-black",
                  selected ? "text-white" : "text-emerald-800"
                )}
              >
                {formatCurrency(slot.finalPrice)}
              </span>
            )}
            {peak && (
              <span
                className={clsx(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide",
                  peak.className
                )}
              >
                <Flame className="h-2.5 w-2.5" />
                {peak[language]}
              </span>
            )}
            {slot.ruleNames.length > 0 && slot.status === "AVAILABLE" && !peak && (
              <Sparkles className="h-3 w-3 text-amber-500" aria-hidden />
            )}
          </div>
        </div>
        {peakAccent && (
          <span className="pointer-events-none absolute right-1 top-1 inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
        )}

        {showTooltip && slot.status === "AVAILABLE" && (
          <SlotTooltip slot={slot} language={language} />
        )}
      </button>

      {manageable && onManage && slot.status === "AVAILABLE" && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onManage(slot);
          }}
          className="absolute right-1 top-1 z-10 rounded-full p-0.5 text-emerald-700/60 hover:bg-white hover:text-emerald-700"
          title={language === "en" ? "Lock this slot" : "Khoá khung giờ"}
        >
          <LockKeyholeOpen className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function SlotTooltip({ slot, language }: { slot: WeeklyScheduleSlot; language: Language }) {
  const peak = slot.predictionLevel && slot.predictionStatus === "GENERATED"
    ? predictionAccent(slot.predictionLevel)
    : null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-[11px] font-bold text-white shadow-lg group-hover:block group-focus-within:block">
      <p className="text-emerald-300">
        {slot.startTime} - {slot.endTime}
      </p>
      <p>
        <span className="text-slate-300">{language === "en" ? "Base" : "Giá"}:</span>{" "}
        {formatCurrency(slot.basePrice)}
      </p>
      {slot.dynamicAdjustmentAmount > 0 && (
        <p>
          <span className="text-amber-300">{language === "en" ? "Dynamic" : "Giá động"}:</span> +
          {formatCurrency(slot.dynamicAdjustmentAmount)}
        </p>
      )}
      <p className="text-emerald-200">
        <span className="text-slate-300">{language === "en" ? "Final" : "Tổng"}:</span>{" "}
        {formatCurrency(slot.finalPrice)}
      </p>
      {peak && (
        <p>
          <span className="text-slate-300">{language === "en" ? "Demand" : "Kín sân"}:</span>{" "}
          {predictionLabel(slot.predictionLevel, language)}
        </p>
      )}
      {slot.ruleNames.length > 0 && (
        <p className="text-amber-300">{slot.ruleNames.join(", ")}</p>
      )}
    </div>
  );
}