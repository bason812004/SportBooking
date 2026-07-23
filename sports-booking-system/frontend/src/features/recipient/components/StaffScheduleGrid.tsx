import { useCallback, useMemo, useState } from "react";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { WeeklyCalendarSection } from "../../bookings/components/BookingCalendar/WeeklyCalendarSection";
import { formatYmd, startOfWeek } from "../../bookings/components/BookingCalendar/utils";
import type { WeeklyScheduleSlot } from "../../../types/api";
import { useSurfaceWeeklySchedule } from "../hooks/useSurfaceWeeklySchedule";
import { useWalkInBooking } from "./WalkInBookingForm";

type WalkIn = ReturnType<typeof useWalkInBooking>;

/**
 * Drop-in replacement for `WalkInScheduleField` on the "Quản lý sân" page —
 * same mode toggle ("Theo khung giờ" / "Bắt đầu ngay") and time-cluster chips,
 * but the "Theo khung giờ" picker is the full weekly calendar UI reused from
 * the customer booking page instead of a flat single-day slot grid.
 */
export function StaffScheduleGrid({
  courtSurfaceId,
  surfaceName,
  bookingDate,
  onDateChange,
  walkIn
}: {
  courtSurfaceId: string;
  surfaceName: string;
  bookingDate: string;
  onDateChange: (date: string) => void;
  walkIn: WalkIn;
}) {
  const {
    isToday,
    repeatWeekly,
    mode,
    setMode,
    walkInSlots,
    setWalkInSlots,
    customStart,
    setCustomStart,
    customMinutes,
    setCustomMinutes,
    bookedRanges,
    activeWalkInPayment
  } = walkIn;

  const [weekStart, setWeekStart] = useState(() => startOfWeek(bookingDate));
  const [focusedDate, setFocusedDate] = useState(() => new Date(`${bookingDate}T00:00:00`));

  const schedule = useSurfaceWeeklySchedule(courtSurfaceId, weekStart, surfaceName);

  const selected = useMemo<WeeklyScheduleSlot[]>(
    () =>
      walkInSlots
        .filter((slot) => (slot.courtSurfaceId ?? courtSurfaceId) === courtSurfaceId)
        .map((slot) => ({
          date: slot.date ?? bookingDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: "AVAILABLE",
          basePrice: 0,
          finalPrice: 0,
          dynamicAdjustmentAmount: 0,
          adjustments: [],
          ruleNames: [],
          predictionLevel: null,
          predictionStatus: "INSUFFICIENT_DATA",
          predictedOccupancyRate: null,
          blockReason: null,
          bookingCode: null
        })),
    [walkInSlots, bookingDate, courtSurfaceId]
  );

  const handleSelectedChange = useCallback(
    (next: WeeklyScheduleSlot[]) => {
      setWalkInSlots((current) => [
        ...current.filter((slot) => (slot.courtSurfaceId ?? courtSurfaceId) !== courtSurfaceId),
        ...next.map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime, date: slot.date, courtSurfaceId }))
      ]);
    },
    [setWalkInSlots, courtSurfaceId]
  );

  const handleFocusedDateChange = useCallback(
    (next: Date) => {
      setFocusedDate(next);
      onDateChange(formatYmd(next));
    },
    [onDateChange]
  );

  if (activeWalkInPayment) return null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Chọn khung giờ</span>
        {isToday && !repeatWeekly ? (
          <div className="flex overflow-hidden rounded-lg border border-emerald-200 text-xs font-bold">
            <button type="button" onClick={() => setMode("grid")} className={`px-2 py-1 transition ${mode === "grid" ? "bg-emerald-600 text-white" : "bg-white text-emerald-700"}`}>
              Theo khung giờ
            </button>
            <button type="button" onClick={() => setMode("now")} className={`px-2 py-1 transition ${mode === "now" ? "bg-emerald-600 text-white" : "bg-white text-emerald-700"}`}>
              Bắt đầu ngay
            </button>
          </div>
        ) : null}
      </div>

      {mode === "now" ? (
        <div className="space-y-2">
          <p className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${bookedRanges.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {bookedRanges.length ? `Đã có khách: ${bookedRanges.join(", ")}` : "Sân trống cả ngày hôm nay"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Giờ bắt đầu" type="time" value={customStart} onChange={(event) => setCustomStart(event.target.value)} required />
            <Select
              label="Thời lượng"
              value={String(customMinutes)}
              onChange={(event) => setCustomMinutes(Number(event.target.value))}
              options={[30, 60, 90, 120, 150, 180].map((value) => ({ value: String(value), label: `${value} phút` }))}
            />
          </div>
        </div>
      ) : (
        <WeeklyCalendarSection
          response={schedule.data}
          isLoading={schedule.isLoading}
          isError={schedule.isError}
          error={schedule.error}
          onRetry={schedule.refetch}
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
          focusedDate={focusedDate}
          onFocusedDateChange={handleFocusedDateChange}
          selected={selected}
          onSelectedChange={handleSelectedChange}
          language="vi"
          forceDayOnCompact
          selectionMode="multi-day"
        />
      )}
    </div>
  );
}
