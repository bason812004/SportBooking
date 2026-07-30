import { useMemo, useRef, useState } from "react";
import {
  addDays,
  formatLongDayLabel,
  formatWeekRangeLabel,
  formatYmd,
  startOfWeek
} from "../features/bookings/components/BookingCalendar/utils";

export type RangeMode = "day" | "week" | "month" | "custom";

export const rangeModeLabel: Record<RangeMode, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
  custom: "Tuỳ chỉnh"
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
}

/**
 * Day/Week/Month/Custom date-range picker used by booking-management tables
 * (originally built inline in PartnerBookingsPage/RecipientBookingsPage —
 * extracted here so a 3rd copy isn't pasted for AdminBookingsPage).
 */
export function usePeriodRange(options?: { defaultMode?: RangeMode; onChange?: () => void }) {
  const defaultMode = options?.defaultMode ?? "day";
  const onChange = options?.onChange;

  const [rangeMode, setRangeMode] = useState<RangeMode>(defaultMode);
  const [periodAnchor, setPeriodAnchor] = useState(() => (defaultMode === "month" ? startOfMonth(new Date()) : new Date()));
  const [customFrom, setCustomFrom] = useState(() => currentYearRange().fromDate);
  const [customTo, setCustomTo] = useState(() => currentYearRange().toDate);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const periodDateInputRef = useRef<HTMLInputElement>(null);

  const range = useMemo(() => {
    if (rangeMode === "day") {
      const d = formatYmd(periodAnchor);
      return { fromDate: d, toDate: d };
    }
    if (rangeMode === "week") {
      const start = startOfWeek(periodAnchor);
      return { fromDate: formatYmd(start), toDate: formatYmd(addDays(start, 6)) };
    }
    if (rangeMode === "month") {
      return { fromDate: formatYmd(startOfMonth(periodAnchor)), toDate: formatYmd(endOfMonth(periodAnchor)) };
    }
    return { fromDate: customFrom, toDate: customTo };
  }, [rangeMode, periodAnchor, customFrom, customTo]);

  const periodLabel = useMemo(() => {
    if (rangeMode === "day") return formatLongDayLabel(periodAnchor, "vi");
    if (rangeMode === "week") return formatWeekRangeLabel(startOfWeek(periodAnchor), addDays(startOfWeek(periodAnchor), 6), "vi");
    if (rangeMode === "month") return `Tháng ${periodAnchor.getMonth() + 1}/${periodAnchor.getFullYear()}`;
    return "";
  }, [rangeMode, periodAnchor]);

  const switchRangeMode = (mode: RangeMode) => {
    setRangeMode(mode);
    onChange?.();
    if (mode === "day" || mode === "week") setPeriodAnchor(new Date());
    else if (mode === "month") setPeriodAnchor(startOfMonth(new Date()));
  };

  const shiftPeriod = (direction: 1 | -1) => {
    setPeriodAnchor((current) => {
      const next = new Date(current);
      if (rangeMode === "week") next.setDate(next.getDate() + direction * 7);
      else if (rangeMode === "month") {
        next.setDate(1);
        next.setMonth(next.getMonth() + direction);
      } else next.setDate(next.getDate() + direction);
      return next;
    });
    onChange?.();
  };

  const jumpToTodayPeriod = () => {
    setPeriodAnchor(rangeMode === "month" ? startOfMonth(new Date()) : new Date());
    onChange?.();
  };

  const openPicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  };

  const openMonthPicker = () => {
    setPickerYear(periodAnchor.getFullYear());
    setMonthPickerOpen(true);
  };

  const selectMonth = (year: number, month: number) => {
    setPeriodAnchor(new Date(year, month, 1));
    onChange?.();
    setMonthPickerOpen(false);
  };

  const selectDay = (value: string) => {
    if (!value) return;
    setPeriodAnchor(new Date(`${value}T00:00:00`));
    onChange?.();
  };

  const setCustomFromValue = (value: string) => {
    setCustomFrom(value);
    onChange?.();
  };

  const setCustomToValue = (value: string) => {
    setCustomTo(value);
    onChange?.();
  };

  const reset = () => {
    setRangeMode(defaultMode);
    setPeriodAnchor(defaultMode === "month" ? startOfMonth(new Date()) : new Date());
    const year = currentYearRange();
    setCustomFrom(year.fromDate);
    setCustomTo(year.toDate);
    onChange?.();
  };

  return {
    rangeMode,
    periodAnchor,
    customFrom,
    customTo,
    monthPickerOpen,
    pickerYear,
    periodDateInputRef,
    range,
    periodLabel,
    switchRangeMode,
    shiftPeriod,
    jumpToTodayPeriod,
    openPicker,
    openMonthPicker,
    setMonthPickerOpen,
    setPickerYear,
    selectMonth,
    selectDay,
    setCustomFrom: setCustomFromValue,
    setCustomTo: setCustomToValue,
    reset
  };
}

export type PeriodRange = ReturnType<typeof usePeriodRange>;
