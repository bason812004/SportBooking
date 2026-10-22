import { useMemo } from "react";
import type {
  WeeklyScheduleDay,
  WeeklyScheduleResponse,
  WeeklyScheduleSlot
} from "../../../../types/api";
import { DayColumn } from "./DayColumn";
import { Timeline } from "./Timeline";
import {
  buildHours,
  buildWeekDates,
  formatYmd,
  slotKey,
  type Language
} from "./utils";

export type BookingCalendarProps = {
  response: WeeklyScheduleResponse;
  weekStart: Date;
  selected: WeeklyScheduleSlot[];
  onToggle: (slot: WeeklyScheduleSlot) => void;
  onSelectDay: (date: Date) => void;
  language: Language;
  manageable?: boolean;
  onManage?: (slot: WeeklyScheduleSlot) => void;
};

export function BookingCalendar({
  response,
  weekStart,
  selected,
  onToggle,
  onSelectDay,
  language,
  manageable,
  onManage
}: BookingCalendarProps) {
  const hours = useMemo(
    () => buildHours(response.openingTime, response.closingTime),
    [response.openingTime, response.closingTime]
  );
  const days = useMemo(() => buildWeekDates(weekStart), [weekStart]);
  const selectedKeys = useMemo(() => new Set(selected.map(slotKey)), [selected]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayMap = useMemo(() => {
    const map = new Map<string, WeeklyScheduleDay>();
    for (const day of response.days) map.set(day.date, day);
    return map;
  }, [response.days]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[860px]">
        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-slate-100 bg-slate-50">
          <div className="px-3 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">
            {language === "en" ? "Time" : "Giờ"}
          </div>
          {days.map((day, index) => {
            const isToday = day.getTime() === today.getTime();
            const dateKey = formatYmd(day);
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectDay(day)}
                className={`flex flex-col items-center gap-0.5 border-l border-slate-100 px-2 py-3 text-center transition hover:bg-emerald-50 ${
                  isToday ? "bg-emerald-50 text-emerald-700" : "text-slate-700"
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-wide">
                  {day.toLocaleDateString(language === "en" ? "en-US" : "vi-VN", {
                    weekday: "short"
                  })}
                </span>
                <span
                  className={`text-base font-black leading-none ${
                    isToday ? "text-emerald-700" : "text-slate-950"
                  }`}
                >
                  {day.getDate()}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {day.toLocaleDateString(language === "en" ? "en-US" : "vi-VN", {
                    month: "short"
                  })}
                </span>
                <span className="sr-only">day {index + 1}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))]">
          <Timeline hours={hours} language={language} />
          {days.map((day) => {
            const dateKey = formatYmd(day);
            return (
              <DayColumn
                key={dateKey}
                day={dayMap.get(dateKey)}
                hours={hours}
                selectedKeys={selectedKeys}
                onToggle={onToggle}
                language={language}
                manageable={manageable}
                onManage={onManage}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}