import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import { formatYmd, WEEK_DAY_LABELS_EN, WEEK_DAY_LABELS_VI, type Language } from "./utils";

export type WeekHeaderProps = {
  weekStart: Date;
  focusedDate?: Date;
  language: Language;
  onSelectDay?: (date: Date) => void;
};

export function WeekHeader({ weekStart, focusedDate, language, onSelectDay }: WeekHeaderProps) {
  const days = Array.from({ length: 7 }).map((_, index) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + index);
    return d;
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const labels = language === "en" ? WEEK_DAY_LABELS_EN : WEEK_DAY_LABELS_VI;
  return (
    <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-slate-100 bg-slate-50">
      <div className="flex items-center justify-center gap-1 px-2 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
        <CalendarDays className="h-3.5 w-3.5" />
        {language === "en" ? "Time" : "Giờ"}
      </div>
      {days.map((day, index) => {
        const isToday = day.getTime() === today.getTime();
        const isFocused = focusedDate ? day.getTime() === focusedDate.getTime() : isToday;
        const dateKey = formatYmd(day);
        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onSelectDay?.(day)}
            className={clsx(
              "flex flex-col items-center justify-center gap-0.5 border-l border-slate-100 px-2 py-3 text-center text-xs font-bold text-slate-600 transition hover:bg-emerald-50",
              isFocused && "bg-emerald-50/80"
            )}
            aria-label={`${labels[index]} ${day.getDate()}/${day.getMonth() + 1}`}
          >
            <span
              className={clsx(
                "text-[10px] font-black uppercase tracking-wide",
                isToday ? "text-emerald-700" : "text-slate-500"
              )}
            >
              {labels[index]}
            </span>
            <span
              className={clsx(
                "text-base font-black leading-none",
                isToday ? "text-emerald-700" : "text-slate-950"
              )}
            >
              {day.getDate()}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {day.toLocaleDateString(language === "en" ? "en-US" : "vi-VN", { month: "short" })}
            </span>
          </button>
        );
      })}
    </div>
  );
}