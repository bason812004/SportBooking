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
    "absolute inset-0 select-none px-2 py-1 text-left text-[13px] font-semibold transition-all duration-150",
    interactive && "cursor-pointer hover:-translate-y-px",
    !interactive && "cursor-not-allowed",
    slot.status === "AVAILABLE" && !selected && "bg-emerald-100 text-[#047857] hover:bg-emerald-200",
    selected && "bg-[#02712a] text-white shadow-md ring-2 ring-[#02712a]",
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
        {/* No start time here: the grid's "Giờ" column gives it (the button's label still says it). */}
        <div className="flex h-full items-center justify-between gap-1">
          {Icon ? (
            <span className="truncate text-[11px] font-bold uppercase tracking-wide">
              {statusLabel(slot.status, language)}
            </span>
          ) : (
            // The price, left-aligned: 13px, 14px on hover and once picked.
            <span
              className={clsx(
                "truncate font-bold transition-[font-size] duration-150",
                selected ? "text-[14px] text-white" : clsx("text-[13px] text-[#047857]", interactive && "group-hover:text-[14px]")
              )}
            >
              {formatCurrency(slot.finalPrice)}
            </span>
          )}
          <span className="flex shrink-0 items-center gap-1">
            {/* With the larger price, the demand level is a coloured flame here; its words are in the tooltip. */}
            {peak && (
              <span
                className={clsx("inline-flex items-center rounded-full p-1", peak.className)}
                title={peak[language]}
              >
                <Flame className="h-3 w-3" aria-hidden />
                <span className="sr-only">{peak[language]}</span>
              </span>
            )}
            {slot.ruleNames.length > 0 && slot.status === "AVAILABLE" && !peak && (
              <Sparkles className="h-3 w-3 text-amber-500" aria-hidden />
            )}
            {Icon ? <Icon className="h-3.5 w-3.5 opacity-80" aria-hidden /> : null}
          </span>
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
    <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg group-hover:block group-focus-within:block">
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
      {slot.dynamicAdjustmentAmount < 0 && (
        <p>
          <span className="text-emerald-300">{language === "en" ? "Discount" : "Giảm giá"}:</span> -
          {formatCurrency(-slot.dynamicAdjustmentAmount)}
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