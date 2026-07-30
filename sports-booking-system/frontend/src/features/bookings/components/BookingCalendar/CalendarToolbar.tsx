import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import clsx from "clsx";
import { format, startOfWeek as startOfWeekFns, addDays, isSameWeek } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { getDefaultClassNames } from "react-day-picker";
import type { Language } from "./utils";

export type CalendarToolbarProps = {
  weekStart: Date;
  weekEnd: Date;
  language: Language;
  courtName: string;
  view: "WEEK" | "DAY";
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickWeek: (dateStr: string) => void;
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

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(weekStart);
  const pickerRef = useRef<HTMLDivElement>(null);

  const locale = language === "vi" ? vi : enUS;

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  const weekLabel = `${format(weekStart, "dd/MM/yyyy", { locale })} – ${format(weekEnd, "dd/MM/yyyy", { locale })}`;

  function handleDayClick(day: Date) {
    const newWeekStart = startOfWeekFns(day, { locale });
    onPickWeek(format(newWeekStart, "yyyy-MM-dd"));
    setPickerOpen(false);
  }

  function currentWeekMod(day: Date) {
    return isSameWeek(day, weekStart, { locale, weekStartsOn: 1 });
  }

  const defaultClassNames = getDefaultClassNames();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      {/* Left: title */}
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

      {/* Center: navigation */}
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

        {/* Week label + date picker */}
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => {
              setPickerMonth(weekStart);
              setPickerOpen((o) => !o);
            }}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:border-emerald-400 hover:text-emerald-700"
          >
            <CalendarDays className="h-4 w-4 text-emerald-600" />
            {weekLabel}
          </button>

          {pickerOpen && (
            <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
              <DayPicker
                mode="single"
                required
                selected={weekStart}
                onSelect={handleDayClick}
                month={pickerMonth}
                onMonthChange={setPickerMonth}
                locale={locale}
                showOutsideDays
                fixedWeeks
                disabled={[
                  { before: new Date(2020, 0, 1) },
                  { after: addDays(new Date(), 365 * 5) }
                ]}
                modifiers={{ currentWeek: currentWeekMod }}
                modifiersClassNames={{
                  currentWeek: "bg-emerald-100 font-black text-emerald-800"
                }}
                classNames={{
                  root: defaultClassNames.root,
                  months: defaultClassNames.months,
                  month: defaultClassNames.month,
                  caption_label: clsx("text-sm font-black text-slate-800", defaultClassNames.caption_label),
                  nav: clsx("flex items-center gap-1", defaultClassNames.nav),
                  button_previous: clsx(
                    "grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700",
                    defaultClassNames.button_previous
                  ),
                  button_next: clsx(
                    "grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700",
                    defaultClassNames.button_next
                  ),
                  months_dropdown: defaultClassNames.months_dropdown,
                  years_dropdown: defaultClassNames.years_dropdown,
                  dropdown: defaultClassNames.dropdown,
                  dropdown_root: defaultClassNames.dropdown_root,
                  month_grid: clsx("border-collapse", defaultClassNames.month_grid),
                  weekdays: defaultClassNames.weekdays,
                  weekday: clsx("py-1 text-center text-[10px] font-black uppercase tracking-wide text-slate-400", defaultClassNames.weekday),
                  weeks: defaultClassNames.weeks,
                  week_number: defaultClassNames.week_number,
                  week_number_header: defaultClassNames.week_number_header,
                  week: defaultClassNames.week,
                  day: clsx(
                    "h-9 w-9 rounded-lg text-sm font-semibold transition hover:bg-emerald-50",
                    defaultClassNames.day
                  ),
                  day_button: clsx(
                    "h-9 w-9 rounded-lg transition hover:bg-emerald-50",
                    defaultClassNames.day_button
                  ),
                  outside: clsx("text-slate-300", defaultClassNames.outside),
                  disabled: clsx("text-slate-300 hover:bg-transparent", defaultClassNames.disabled),
                  hidden: defaultClassNames.hidden,
                  today: clsx("font-black text-emerald-700", defaultClassNames.today),
                  selected: clsx("bg-emerald-700 text-white hover:bg-emerald-600", defaultClassNames.selected),
                  focused: defaultClassNames.focused,
                  range_start: defaultClassNames.range_start,
                  range_end: defaultClassNames.range_end,
                  range_middle: defaultClassNames.range_middle,
                  chevron: defaultClassNames.chevron,
                  footer: defaultClassNames.footer
                }}
              />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    const newWeekStart = startOfWeekFns(pickerMonth, { locale });
                    onPickWeek(format(newWeekStart, "yyyy-MM-dd"));
                    setPickerOpen(false);
                  }}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                >
                  {language === "vi" ? "Chọn tuần này" : "Select this week"}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onNext}
          aria-label={language === "en" ? "Next week" : "Tuần sau"}
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Right: view toggle */}
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
