import { DayPicker, getDefaultClassNames, type Matcher } from "react-day-picker";
import type { Locale } from "date-fns";
import clsx from "clsx";

type Props = {
  selected: Date | undefined;
  onSelect: (date: Date) => void;
  month: Date;
  onMonthChange: (date: Date) => void;
  locale: Locale;
  disabled?: Matcher[];
  required?: boolean;
};

export function DayPickerCalendar({ selected, onSelect, month, onMonthChange, locale, disabled, required }: Props) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
      <DayPicker
        mode="single"
        required={required}
        selected={selected}
        onSelect={(date: Date | undefined) => date && onSelect(date)}
        month={month}
        onMonthChange={onMonthChange}
        locale={locale}
        showOutsideDays
        fixedWeeks
        disabled={disabled}
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
          weekday: clsx(
            "py-1 text-center text-[10px] font-black uppercase tracking-wide text-slate-400",
            defaultClassNames.weekday
          ),
          weeks: defaultClassNames.weeks,
          week_number: defaultClassNames.week_number,
          week_number_header: defaultClassNames.week_number_header,
          week: defaultClassNames.week,
          day: clsx("h-9 w-9 rounded-lg text-sm font-semibold transition hover:bg-emerald-50", defaultClassNames.day),
          day_button: clsx("h-9 w-9 rounded-lg transition hover:bg-emerald-50", defaultClassNames.day_button),
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
    </div>
  );
}
