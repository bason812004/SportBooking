import clsx from "clsx";
import { Flame, Lock, Sparkles, Wrench, X } from "lucide-react";
import type { WeeklyScheduleSlot } from "../../../../types/api";
import { formatCurrency } from "../../../../lib/format";
import { isSlotSelectable, predictionAccent, predictionLabel, statusLabel, type Language } from "./utils";

export type BookingBlockProps = {
  slot: WeeklyScheduleSlot | undefined;
  selected?: boolean;
  onToggle?: (slot: WeeklyScheduleSlot) => void;
  language: Language;
  showTooltip?: boolean;
};

export function BookingBlock({ slot, selected, onToggle, language, showTooltip = true }: BookingBlockProps) {
  if (!slot) {
    return <div className="border-b border-l border-slate-100" aria-hidden />;
  }

  const interactive = isSlotSelectable(slot) && Boolean(onToggle);

  const classes = clsx(
    "group relative h-12 select-none border-l border-b border-slate-100 px-1.5 py-1 text-left text-[11px] font-bold transition-all duration-150",
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
    <button
      type="button"
      onClick={interactive ? () => onToggle!(slot) : undefined}
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