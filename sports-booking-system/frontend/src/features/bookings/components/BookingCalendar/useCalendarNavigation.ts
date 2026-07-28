import React, { useCallback, useMemo, useState } from "react";
import { addDays, format, startOfWeek as startOfWeekFns, isSameWeek, isSameDay } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import type { Language } from "./utils";
import type { WeeklyScheduleSlot } from "../../../../types/api";
import { slotKey } from "./utils";

export type CalendarView = "WEEK" | "DAY";

export interface CalendarNavigationOptions {
  /** Week start (Monday). Defaults to current week. */
  initialWeekStart?: Date;
  /** Focused date. Defaults to today. */
  initialFocusedDate?: Date;
  /** Initial selected slots. Defaults to empty. */
  initialSelected?: WeeklyScheduleSlot[];
  language?: Language;
}

export interface CalendarNavigationResult {
  // State
  weekStart: Date;
  weekEnd: Date;
  focusedDate: Date;
  view: CalendarView;
  selectedSlots: WeeklyScheduleSlot[];
  // Setters
  setWeekStart: (d: Date) => void;
  setFocusedDate: (d: Date) => void;
  setView: (v: CalendarView) => void;
  setSelectedSlots: (slots: WeeklyScheduleSlot[]) => void;
  // Navigation
  goToNextWeek: () => void;
  goToPrevWeek: () => void;
  goToToday: () => void;
  goToDate: (date: Date) => void;
  goToWeek: (weekStart: Date) => void;
  // Slot helpers
  toggleSlot: (slot: WeeklyScheduleSlot) => void;
  clearSlots: () => void;
  // URL params (strings for URLSearchParams)
  weekStartParam: string;
  focusedDateParam: string;
  selectedSlotsParams: Array<{ date: string; startTime: string; endTime: string }>;
  // Helpers
  isInCurrentWeek: (date: Date) => boolean;
  isToday: (date: Date) => boolean;
  isFocused: (date: Date) => boolean;
  weekLabel: string;
}

function getLocale(language: Language) {
  return language === "vi" ? vi : enUS;
}

export function useCalendarNavigation(
  options: CalendarNavigationOptions = {}
): CalendarNavigationResult {
  const {
    initialWeekStart,
    initialFocusedDate,
    initialSelected = [],
    language = "vi"
  } = options;

  const locale = getLocale(language);

  const [weekStart, setWeekStart] = useState<Date>(
    () => initialWeekStart ?? startOfWeekFns(new Date())
  );
  const [focusedDate, setFocusedDate] = useState<Date>(
    () => initialFocusedDate ?? new Date()
  );
  const [view, setView] = useState<CalendarView>("WEEK");
  const [selectedSlots, setSelectedSlots] = useState<WeeklyScheduleSlot[]>(initialSelected);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const weekLabel = useMemo(() => {
    const fmt = language === "vi" ? "dd/MM/yyyy" : "MMM d, yyyy";
    return `${format(weekStart, fmt, { locale })} – ${format(weekEnd, fmt, { locale })}`;
  }, [weekStart, weekEnd, language, locale]);

  const goToNextWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, 7));
  }, []);

  const goToPrevWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, -7));
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setWeekStart(startOfWeekFns(today));
    setFocusedDate(today);
    setView("DAY");
  }, []);

  const goToDate = useCallback((date: Date) => {
    setFocusedDate(date);
    setWeekStart(startOfWeekFns(date));
    setView("DAY");
  }, []);

  const goToWeek = useCallback((newWeekStart: Date) => {
    setWeekStart(newWeekStart);
  }, []);

  const toggleSlot = useCallback((slot: WeeklyScheduleSlot) => {
    if (slot.status !== "AVAILABLE") return;
    setSelectedSlots((prev) => {
      const key = slotKey(slot);
      const exists = prev.some((s) => slotKey(s) === key);
      if (exists) {
        return prev.filter((s) => slotKey(s) !== key);
      }
      return [...prev, slot].sort((a, b) => {
        const dc = a.date.localeCompare(b.date);
        return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
      });
    });
  }, []);

  const clearSlots = useCallback(() => {
    setSelectedSlots([]);
  }, []);

  const weekStartParam = format(weekStart, "yyyy-MM-dd");
  const focusedDateParam = format(focusedDate, "yyyy-MM-dd");
  const selectedSlotsParams = selectedSlots.map((s) => ({
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime
  }));

  const isInCurrentWeek = useCallback(
    (date: Date) => isSameWeek(date, weekStart, { locale, weekStartsOn: 1 }),
    [weekStart, locale]
  );

  const isToday = useCallback((date: Date) => isSameDay(date, new Date()), []);

  const isFocused = useCallback(
    (date: Date) => isSameDay(date, focusedDate),
    [focusedDate]
  );

  return {
    weekStart,
    weekEnd,
    focusedDate,
    view,
    selectedSlots,
    setWeekStart,
    setFocusedDate,
    setView,
    setSelectedSlots,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    goToDate,
    goToWeek,
    toggleSlot,
    clearSlots,
    weekStartParam,
    focusedDateParam,
    selectedSlotsParams,
    isInCurrentWeek,
    isToday,
    isFocused,
    weekLabel
  };
}
