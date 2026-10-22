import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { courtApi } from "../api/courts";
import { queryKeys } from "../api/queryKeys";
import type { AvailabilitySlot } from "../api/types";
import { formatClock, todayKey, weekStartKey } from "../utils/format";

// Slots of one day for one surface, read from the weekly schedule the web booking page uses.
export function useCourtSchedule(courtId: string, date: string, surfaceId: string | null, enabled = true) {
  const weekStart = weekStartKey(date);
  const schedule = useQuery({
    queryKey: queryKeys.courtSchedule(courtId, weekStart, surfaceId),
    queryFn: () => courtApi.weeklySchedule(courtId, weekStart, surfaceId ?? undefined),
    enabled: Boolean(courtId) && enabled,
    staleTime: 30 * 1000
  });

  const slots = useMemo<AvailabilitySlot[]>(() => {
    const day = schedule.data?.days.find((item) => item.date === date);
    // The weekly schedule only emits OUTSIDE_HOURS for hours that have already started. The local
    // clock check covers hours that start while this screen stays open on cached data.
    const nowClock = date === todayKey() ? formatClock(new Date()) : null;
    return (day?.slots ?? []).map((slot) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      status:
        slot.status === "OUTSIDE_HOURS" || (nowClock && slot.status === "AVAILABLE" && slot.startTime <= nowClock)
          ? "PASSED"
          : slot.status,
      price: slot.finalPrice,
      courtSurfaceId: slot.courtSurfaceId ?? null,
      courtSurfaceName: slot.courtSurfaceName ?? null,
      bookingId: null
    }));
  }, [schedule.data, date]);

  return { slots, isLoading: schedule.isLoading, isError: schedule.isError, error: schedule.error, refetch: schedule.refetch };
}
