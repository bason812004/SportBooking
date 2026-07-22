import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { WeeklyScheduleResponse, WeeklyScheduleSlot } from "../../../../types/api";
import {
  buildHours,
  findDay,
  formatLongDayLabel,
  formatYmd,
  isSlotSelectable,
  predictionAccent,
  predictionLabel,
  slotKey,
  statusLabel,
  type Language
} from "./utils";

export type DayViewProps = {
  response: WeeklyScheduleResponse;
  date: Date;
  onChangeDate: (date: Date) => void;
  selected: WeeklyScheduleSlot[];
  onToggle: (slot: WeeklyScheduleSlot) => void;
  onBackToWeek: () => void;
  language: Language;
};

export function DayView(props: DayViewProps) {
  const { response, date, onChangeDate, selected, onToggle, onBackToWeek, language } = props;
  const dateKey = formatYmd(date);
  const day = useMemo(() => findDay(response, dateKey), [response, dateKey]);
  const hours = useMemo(
    () => buildHours(response.openingTime, response.closingTime),
    [response.openingTime, response.closingTime]
  );
  const slotsByHour = useMemo(() => {
    const map = new Map<string, WeeklyScheduleSlot>();
    if (day) for (const slot of day.slots) map.set(slot.startTime, slot);
    return map;
  }, [day]);

  const totals = useMemo(() => {
    if (!day) return { available: 0, booked: 0, blocked: 0 };
    return {
      available: day.slots.filter((s: WeeklyScheduleSlot) => s.status === "AVAILABLE").length,
      booked: day.slots.filter((s: WeeklyScheduleSlot) => s.status === "BOOKED").length,
      blocked: day.slots.filter(
        (s: WeeklyScheduleSlot) => s.status === "BLOCKED" || s.status === "MAINTENANCE"
      ).length
    };
  }, [day]);

  const selectedKeys = useMemo(() => new Set(selected.map(slotKey)), [selected]);

  const dayOffset = (offset: number) => {
    const next = new Date(date);
    next.setDate(date.getDate() + offset);
    onChangeDate(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          type="button"
          onClick={onBackToWeek}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
        >
          {language === "en" ? "Back to week" : "Về tuần"}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dayOffset(-1)}
            aria-label={language === "en" ? "Previous day" : "Ngày trước"}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="rounded-xl bg-slate-50 px-4 py-1.5 text-sm font-black text-slate-800 ring-1 ring-slate-200">
            {formatLongDayLabel(date, language)}
          </span>
          <button
            type="button"
            onClick={() => dayOffset(1)}
            aria-label={language === "en" ? "Next day" : "Ngày sau"}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            {totals.available} {language === "en" ? "available" : "còn trống"}
          </span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
            {totals.booked} {language === "en" ? "booked" : "đã đặt"}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            {totals.blocked} {language === "en" ? "blocked" : "khoá/bảo trì"}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {hours.map((hour) => {
            const slot = slotsByHour.get(hour);
            if (!slot) {
              return (
                <li
                  key={hour}
                  className="flex items-center justify-between px-4 py-3 text-xs text-slate-400"
                >
                  <span className="font-black text-slate-500">{hour}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                    {language === "en" ? "No slot" : "Không có khung giờ"}
                  </span>
                </li>
              );
            }
            const selectedKey = slotKey(slot);
            const isSelected = selectedKeys.has(selectedKey);
            const peak =
              slot.predictionLevel && slot.predictionStatus === "GENERATED"
                ? predictionAccent(slot.predictionLevel)
                : null;
            const statusClasses = clsx(
              "rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide",
              slot.status === "AVAILABLE" && (isSelected ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"),
              slot.status === "BOOKED" && "bg-rose-50 text-rose-700",
              slot.status === "BLOCKED" && "bg-slate-100 text-slate-500",
              slot.status === "MAINTENANCE" && "bg-amber-50 text-amber-700",
              slot.status === "OUTSIDE_HOURS" && "bg-slate-50 text-slate-300",
              slot.status === "HELD" && "bg-yellow-50 text-yellow-700"
            );
            const interactive = isSlotSelectable(slot);
            return (
              <li
                key={selectedKey}
                className={clsx(
                  "grid grid-cols-[88px_minmax(0,1fr)_120px] items-center gap-3 px-4 py-3 transition",
                  interactive && "hover:bg-emerald-50/40"
                )}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-900">
                    {slot.startTime} - {slot.endTime}
                  </span>
                  {slot.ruleNames.length > 0 && (
                    <span className="text-[10px] font-bold text-amber-600">
                      {slot.ruleNames.join(", ")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={statusClasses}>{statusLabel(slot.status, language)}</span>
                  {peak && (
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                        peak.className
                      )}
                    >
                      {predictionLabel(slot.predictionLevel, language)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm font-black text-slate-800">
                    {formatPrice(slot.finalPrice)}
                  </span>
                  <button
                    type="button"
                    disabled={!interactive}
                    onClick={() => onToggle(slot)}
                    className={clsx(
                      "rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition",
                      isSelected
                        ? "bg-emerald-600 text-white"
                        : interactive
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-400"
                    )}
                  >
                    {isSelected
                      ? language === "en"
                        ? "Selected"
                        : "Đã chọn"
                      : language === "en"
                        ? "Pick"
                        : "Chọn"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}