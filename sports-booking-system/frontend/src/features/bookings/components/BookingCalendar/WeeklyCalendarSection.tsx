import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarLegend } from "./CalendarLegend";
import { CalendarHeader } from "./CalendarHeader";
import { BookingCalendar } from "./BookingCalendar";
import { DayView } from "./DayView";
import { isSlotSelectable, slotKey, startOfWeek, type Language } from "./utils";
import type { WeeklyScheduleResponse, WeeklyScheduleSlot } from "../../../../types/api";

export type WeeklyCalendarSectionProps = {
  response: WeeklyScheduleResponse | undefined;
  isLoading?: boolean;
  isError?: boolean;
  error: Error | null;
  onRetry?: () => void;
  weekStart: Date;
  onWeekStartChange: (next: Date) => void;
  focusedDate: Date;
  onFocusedDateChange: (next: Date) => void;
  selected: WeeklyScheduleSlot[];
  onSelectedChange: (next: WeeklyScheduleSlot[]) => void;
  /** When provided, slot toggling uses this global handler (e.g. from BookingContext).
   *  Navigation (prev/next/today) will NOT reset selected slots. */
  onToggleSlot?: (slot: WeeklyScheduleSlot) => void;
  language: Language;
  /** Auto-switch to Day view on compact screens (mobile). Default: true. */
  forceDayOnCompact?: boolean;
  /** Optional side panel slot (e.g. booking summary). */
  rightSlot?: React.ReactNode;
  /**
   * "multi-day" (default) lets the customer booking cart span several different
   * dates (used for multi-day orders). "single-day" is for callers where a
   * selection can only ever belong to one date (e.g. staff walk-in booking) —
   * picking a slot on a different day replaces the whole selection instead of
   * adding to it.
   */
  selectionMode?: "multi-day" | "single-day";
  /** Staff-only: lets clicking a BOOKED/BLOCKED slot open a management action. Off by default. */
  manageable?: boolean;
  onManage?: (slot: WeeklyScheduleSlot) => void;
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
    onToggleSlot,
    language,
    forceDayOnCompact = true,
    rightSlot,
    selectionMode = "multi-day",
    manageable,
    onManage
  } = props;

  const { isCompact } = useResponsiveLayout();
  const [view, setView] = useState<"WEEK" | "DAY">(
    forceDayOnCompact && isCompact ? "DAY" : "WEEK"
  );
  const [userOverride, setUserOverride] = useState(false);

  // Derived view: if user has explicitly overridden, respect their choice;
  // otherwise apply compact-mode default
  const activeView = !userOverride && forceDayOnCompact && isCompact ? "DAY" : view;

  const weekEndDate = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 6);
    return d;
  }, [weekStart]);

  // ── Slot selection ──────────────────────────────────────────────
  const MAX_ORDER_DAYS = 14;

  const toggleSlot = useCallback(
    (slot: WeeklyScheduleSlot) => {
      if (!isSlotSelectable(slot)) return;
      // If a global toggle handler is provided (e.g. from BookingContext), delegate to it.
      // This preserves multi-week slot state across week navigation.
      if (onToggleSlot) {
        onToggleSlot(slot);
        return;
      }
      // Fallback: local selection management.
      const key = slotKey(slot);
      const exists = selected.some((s) => slotKey(s) === key);
      if (exists) {
        onSelectedChange(selected.filter((s) => slotKey(s) !== key));
        return;
      }

      if (selectionMode === "single-day") {
        const sameDay = selected.filter((s) => s.date === slot.date);
        onSelectedChange([...sameDay, slot].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)));
        return;
      }

      const selectedDays = new Set(selected.map((s) => s.date));
      if (!selectedDays.has(slot.date) && selectedDays.size >= MAX_ORDER_DAYS) {
        toast.error(
          language === "en"
            ? `You can select up to ${MAX_ORDER_DAYS} different days per order.`
            : `Chỉ có thể chọn tối đa ${MAX_ORDER_DAYS} ngày khác nhau trong 1 lần đặt.`
        );
        return;
      }

      onSelectedChange([...selected, slot].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)));
    },
    [selected, onSelectedChange, onToggleSlot, language, selectionMode]
  );

  // ── Navigation ────────────────────────────────────────────────
  const jumpToToday = useCallback(() => {
    const today = new Date();
    onWeekStartChange(startOfWeek(today));
    onFocusedDateChange(today);
    if (!onToggleSlot) {
      onSelectedChange([]);
    }
    setUserOverride(false);
    setView(forceDayOnCompact && isCompact ? "DAY" : "WEEK");
  }, [onWeekStartChange, onFocusedDateChange, onSelectedChange, onToggleSlot, forceDayOnCompact, isCompact]);

  const shiftWeek = useCallback(
    (offset: number) => {
      const next = new Date(weekStart);
      next.setDate(weekStart.getDate() + offset);
      onWeekStartChange(next);
    },
    [weekStart, onWeekStartChange]
  );

  const jumpToDate = useCallback(
    (dateStr: string) => {
      const target = new Date(`${dateStr}T00:00:00`);
      onFocusedDateChange(target);
      onWeekStartChange(startOfWeek(target));
      setUserOverride(false);
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

  // ── Render ─────────────────────────────────────────────────
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
        onPickWeek={jumpToDate}
        onSwitchView={(v) => {
          setUserOverride(true);
          setView(v);
        }}
        focusedDate={focusedDate}
        onSelectDay={enterDayView}
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
                manageable={manageable}
                onManage={onManage}
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
                manageable={manageable}
                onManage={onManage}
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

// ── Internal helpers ────────────────────────────────────────────
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
