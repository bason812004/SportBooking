import { useState } from "react";
import { CalendarDays } from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { useLanguage } from "../../lib/i18n";
import { useClickOutside } from "../../hooks/useClickOutside";
import { DayPickerCalendar } from "./DayPickerCalendar";

type Props = {
  label?: string;
  error?: string;
  dense?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  className?: string;
};

function parseYmd(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatYmd(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function DatePicker({
  label,
  error,
  dense,
  value,
  onChange,
  placeholder,
  min,
  max,
  disabled,
  required,
  name,
  className
}: Props) {
  const { language } = useLanguage();
  const locale = language === "vi" ? vi : enUS;

  const selected = parseYmd(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(selected ?? new Date());

  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));

  const disabledMatchers = [
    min ? { before: parseYmd(min)! } : undefined,
    max ? { after: parseYmd(max)! } : undefined
  ].filter((matcher): matcher is { before: Date } | { after: Date } => Boolean(matcher));

  function handleSelect(date: Date) {
    onChange(formatYmd(date));
    setOpen(false);
  }

  return (
    <div className={clsx("relative grid text-sm font-medium text-ink", dense ? "gap-1" : "gap-1.5")} ref={ref}>
      {label && <span className={dense ? "text-xs" : undefined}>{label}</span>}
      <button
        type="button"
        name={name}
        disabled={disabled}
        onClick={() => {
          setMonth(selected ?? new Date());
          setOpen((o) => !o);
        }}
        className={clsx(
          "flex items-center justify-between gap-2 rounded-md border border-line bg-white text-left outline-none focus:border-action disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          dense ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
          className
        )}
      >
        <span className={selected ? undefined : "text-slate-400"}>
          {selected ? format(selected, "dd/MM/yyyy", { locale }) : placeholder ?? ""}
        </span>
        <CalendarDays className={clsx("shrink-0 text-emerald-600", dense ? "h-3.5 w-3.5" : "h-4 w-4")} />
      </button>

      {open && (
        <DayPickerCalendar
          required={required}
          selected={selected}
          onSelect={handleSelect}
          month={month}
          onMonthChange={setMonth}
          locale={locale}
          disabled={disabledMatchers.length ? disabledMatchers : undefined}
        />
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
