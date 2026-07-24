import { useQueries } from "@tanstack/react-query";
import { recipientApi } from "../api/recipientApi";
import { buildWeekDates, formatYmd } from "../../bookings/components/BookingCalendar/utils";
import type { WeeklyScheduleResponse, WeeklyScheduleSlot } from "../../../types/api";

/**
 * Builds a customer-calendar-shaped `WeeklyScheduleResponse` for a single
 * court surface by firing one `recipientApi.surfaceAvailability` call per day
 * of the week (that endpoint is per-day, per-surface — there is no weekly
 * variant, so we compose it client-side instead of adding a new backend route).
 */
export function useSurfaceWeeklySchedule(courtSurfaceId: string, weekStart: Date, surfaceName: string) {
  const dates = buildWeekDates(weekStart).map(formatYmd);

  const queries = useQueries({
    queries: dates.map((date) => ({
      queryKey: ["recipient-surface-availability", courtSurfaceId, date],
      queryFn: () => recipientApi.surfaceAvailability(courtSurfaceId, date),
      enabled: Boolean(courtSurfaceId),
      staleTime: 15_000
    }))
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const error = queries.find((q) => q.isError)?.error as Error | undefined;

  const loaded = queries.every((q) => q.data);
  let response: WeeklyScheduleResponse | undefined;
  if (loaded) {
    const first = queries[0].data!;
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);
    const days = queries.map((q, index) => {
      const day = q.data!;
      const date = dates[index];
      const slots: WeeklyScheduleSlot[] = day.slots.map((slot) => ({
        date: dates[index],
        startTime: slot.startTime,
        endTime: slot.endTime,
        status:
          slot.status === "AVAILABLE" && (date < todayStr || (date === todayStr && slot.startTime <= nowTime))
            ? "OUTSIDE_HOURS"
            : slot.status,
        basePrice: slot.price,
        finalPrice: slot.price,
        dynamicAdjustmentAmount: 0,
        adjustments: [],
        ruleNames: [],
        predictionLevel: null,
        predictionStatus: "INSUFFICIENT_DATA",
        predictedOccupancyRate: null,
        blockReason: slot.reason ?? null,
        bookingCode: slot.bookingCode ?? null,
        bookingId: slot.bookingId ?? null,
        bookingStatus: slot.bookingStatus ?? null,
        customerName: slot.customerName ?? null,
        customerPhone: slot.customerPhone ?? null,
        blockId: slot.blockId ?? null
      }));
      return {
        date: dates[index],
        weekday: new Date(`${dates[index]}T00:00:00`).getDay(),
        slots
      };
    });

    response = {
      court: {
        id: courtSurfaceId,
        name: surfaceName,
        address: null,
        district: null,
        city: null,
        openingTime: first.openingTime,
        closingTime: first.closingTime,
        minPrice: Math.min(...days.flatMap((d) => d.slots.map((s) => s.finalPrice)), 0),
        imageUrl: null,
        category: null
      },
      weekStart: dates[0],
      weekEnd: dates[6],
      slotMinutes: first.slotDurationMinutes,
      openingTime: first.openingTime,
      closingTime: first.closingTime,
      days,
      dynamicPricing: [],
      bookings: [],
      maintenance: [],
      availableVouchers: []
    };
  }

  return {
    data: response,
    isLoading,
    isError,
    error,
    refetch: () => queries.forEach((q) => q.refetch())
  };
}
