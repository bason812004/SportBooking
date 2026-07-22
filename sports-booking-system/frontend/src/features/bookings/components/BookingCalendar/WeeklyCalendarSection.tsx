import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarLegend } from "./CalendarLegend";
import { CalendarHeader } from "./CalendarHeader";
import { BookingCalendar } from "./BookingCalendar";
import { DayView } from "./DayView";
import {
  compareTime,
  findDay,
  formatYmd,
  isSlotSelectable,
  slotKey,
  startOfWeek,
  type Language
} from "./utils";
import type {
  WeeklyScheduleResponse,
  WeeklyScheduleSlot
} from "../../../../types/api";

export type WeeklyCalendarSectionProps = {
  response: WeeklyScheduleResponse | undefined;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  weekStart: Date;
  onWeekStartChange: (next: Date) => void;
  focusedDate: Date;
  onFocusedDateChange: (next: Date) => void;
  selected: WeeklyScheduleSlot[];
  onSelectedChange: (next: WeeklyScheduleSlot[]) => void;
  language: Language;
  /**
   * If true, the calendar auto-switches to Day View on compact screens (mobile).
   * Otherwise the caller controls the view.
   */
  forceDayOnCompact?: boolean;
  rightSlot?: React.ReactNode;
};

export function WeeklyCalendarSection(props: WeeklyCalendarSectionProps) {
  const {
    response,
    isLoading,
    isError,
    error,
    onRetry,
    weekStart,
    onWeekStartChange,
    focusedDate,
    onFocusedDateChange,
    selected,
    onSelectedChange,
    language,
    forceDayOnCompact = true,
    rightSlot
  } = props;

  const { isCompact } = useResponsiveLayout();
  const initialView: "WEEK" | "DAY" = forceDayOnCompact && isCompact ? "DAY" : "WEEK";
  const [view, setView] = useState<"WEEK" | "DAY">(initialView);
  const [userOverride, setUserOverride] = useState(false);
  const activeView = !userOverride && forceDayOnCompact && isCompact ? "DAY" : view;
  const weekEndDate = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 6);
    return d;
  }, [weekStart]);

  const focusedDay = useMemo(
    () => (response ? findDay(response, formatYmd(focusedDate)) : undefined),
    [response, focusedDate]
  );

  const toggleSlot = useCallback(
    (slot: WeeklyScheduleSlot) => {
      if (!isSlotSelectable(slot)) return;
      onSelectedChange(
        toggleSelection(selected, slot)
      );
    },
    [selected, onSelectedChange]
  );

  const jumpToToday = useCallback(() => {
    const today = startOfWeek(new Date());
    onWeekStartChange(today);
    onFocusedDateChange(new Date());
    onSelectedChange([]);
  }, [onWeekStartChange, onFocusedDateChange, onSelectedChange]);

  const shiftWeek = useCallback(
    (offset: number) => {
      const next = new Date(weekStart);
      next.setDate(weekStart.getDate() + offset);
      onWeekStartChange(next);
      onSelectedChange([]);
    },
    [weekStart, onWeekStartChange, onSelectedChange]
  );

  const jumpToDate = useCallback(
    (value: string) => {
      const target = new Date(`${value}T00:00:00`);
      onFocusedDateChange(target);
      onWeekStartChange(startOfWeek(target));
    },
    [onFocusedDateChange, onWeekStartChange]
  );

  const enterDayView = useCallback(
    (date: Date) => {
      onFocusedDateChange(date);
      setUserOverride(true);
      setView("DAY");
    },
    [onFocusedDateChange]
  );

  return (
    <div className="space-y-4">
      <CalendarHeader
        weekStart={weekStart}
        weekEnd={weekEndDate}
        language={language}
        courtName={response?.court?.name ?? ""}
        view={activeView}
        onPrev={() => shiftWeek(-7)}
        onNext={() => shiftWeek(7)}
        onToday={jumpToToday}
        onPickWeek={(value) => jumpToDate(value)}
        onSwitchView={(value) => {
          setUserOverride(true);
          setView(value);
        }}
        focusedDate={focusedDate}
        onSelectDay={enterDayView}
        showWeekHeader={activeView === "WEEK"}
      />
      <CalendarLegend language={language} />

      <div className={rightSlot ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" : ""}>
        <div className="space-y-4">
          {isLoading ? (
            <LoadingBlock />
          ) : isError ? (
            <ErrorBlock
              message={error?.message ?? (language === "en" ? "Failed to load schedule." : "Không tải được lịch.")}
              onRetry={onRetry}
              language={language}
            />
          ) : response ? (
            activeView === "WEEK" ? (
              <BookingCalendar
                response={response}
                weekStart={weekStart}
                selected={selected}
                onToggle={toggleSlot}
                onSelectDay={enterDayView}
                language={language}
              />
            ) : (
              <DayView
                response={response}
                date={focusedDate}
                onChangeDate={onFocusedDateChange}
                selected={selected}
                onToggle={toggleSlot}
                onBackToWeek={() => {
                  if (isCompact) return;
                  setView("WEEK");
                }}
                language={language}
              />
            )
          ) : (
            <EmptyBlock language={language} />
          )}
        </div>
        {rightSlot ? <div className="space-y-4">{rightSlot}</div> : null}
      </div>
    </div>
  );
}

function toggleSelection(current: WeeklyScheduleSlot[], slot: WeeklyScheduleSlot): WeeklyScheduleSlot[] {
  const exists = current.some((s) => slotKey(s) === slotKey(slot));
  if (exists) return current.filter((s) => slotKey(s) !== slotKey(slot));
  const sameDay = current.filter((s) => s.date === slot.date);
  if (sameDay.length === 0) return [...current, slot].sort((a, b) => compareTime(a.startTime, b.startTime));
  const last = sameDay[sameDay.length - 1];
  const lastHour = Number(last.startTime.slice(0, 2));
  const slotHour = Number(slot.startTime.slice(0, 2));
  if (slotHour === lastHour + 1 || slotHour === lastHour - 1) {
    return [...current, slot].sort((a, b) => compareTime(a.startTime, b.startTime));
  }
  return [...current, slot].sort((a, b) => compareTime(a.startTime, b.startTime));
}

function useResponsiveLayout() {
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return { isCompact };
}

function LoadingBlock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid animate-pulse grid-cols-7 gap-2">
        {Array.from({ length: 7 * 18 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function ErrorBlock({
  message,
  onRetry,
  language
}: {
  message: string;
  onRetry?: () => void;
  language: Language;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
      <p className="font-black">{language === "en" ? "Could not load schedule" : "Không tải được lịch"}</p>
      <p className="mt-1">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-black text-white hover:bg-rose-700"
        >
          {language === "en" ? "Retry" : "Thử lại"}
        </button>
      ) : null}
    </div>
  );
}

function EmptyBlock({ language }: { language: Language }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">
      {language === "en" ? "No schedule data yet." : "Chưa có dữ liệu lịch."}
    </div>
  );
}