import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import clsx from "clsx";
import { formatWeekRangeLabel, formatYmd, type Language } from "./utils";

export type CalendarToolbarProps = {
  weekStart: Date;
  weekEnd: Date;
  language: Language;
  courtName: string;
  view: "WEEK" | "DAY";
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickWeek: (date: string) => void;
  onSwitchView: (view: "WEEK" | "DAY") => void;
};

export function CalendarToolbar(props: CalendarToolbarProps) {
  const {
    weekStart,
    weekEnd,
    language,
    courtName,
    view,
    onPrev,
    onNext,
    onToday,
    onPickWeek,
    onSwitchView
  } = props;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
            {language === "en" ? "Weekly booking" : "Lịch đặt sân theo tuần"}
          </p>
          <h2 className="text-lg font-black text-slate-950">{courtName}</h2>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          aria-label={language === "en" ? "Previous week" : "Tuần trước"}
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onToday}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
        >
          {language === "en" ? "Today" : "Hôm nay"}
        </button>

        <span className="rounded-xl bg-slate-50 px-4 py-2 text-sm font-black text-slate-800 ring-1 ring-slate-200">
          {formatWeekRangeLabel(weekStart, weekEnd, language)}
        </span>

        <label className="grid h-10 cursor-pointer place-items-center rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 hover:border-emerald-400">
          <CalendarDays className="mr-1 inline h-4 w-4 text-emerald-600" />
          {language === "en" ? "Pick week" : "Chọn tuần"}
          <input
            type="date"
            className="sr-only"
            value={formatYmd(weekStart)}
            onChange={(event) => {
              if (event.target.value) onPickWeek(event.target.value);
            }}
          />
        </label>

        <button
          type="button"
          onClick={onNext}
          aria-label={language === "en" ? "Next week" : "Tuần sau"}
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-1 self-end rounded-xl bg-slate-100 p-1 md:self-auto">
        <button
          type="button"
          onClick={() => onSwitchView("WEEK")}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-xs font-black transition",
            view === "WEEK" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {language === "en" ? "Week" : "Tuần"}
        </button>
        <button
          type="button"
          onClick={() => onSwitchView("DAY")}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-xs font-black transition",
            view === "DAY" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {language === "en" ? "Day" : "Ngày"}
        </button>
      </div>
    </div>
  );
}