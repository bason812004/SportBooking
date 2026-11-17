import { useEffect } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/axios";
import type { ApiResponse, WeeklyScheduleResponse } from "../../../types/api";

export const bookingScheduleApi = {
  async weekly(courtId: string, weekStart?: string, surfaceId?: string) {
    const params = {
      ...(weekStart ? { weekStart } : {}),
      ...(surfaceId ? { surfaceId } : {})
    };
    const { data } = await api.get<ApiResponse<WeeklyScheduleResponse>>(
      `/courts/${courtId}/weekly-schedule`,
      { params }
    );
    return data.data;
  }
};

export const weeklyScheduleQueryKey = (courtId: string | undefined, weekStart: string | undefined, surfaceId: string | undefined) =>
  (["weekly-schedule", courtId, weekStart ?? "current", surfaceId ?? "ALL"] as const);

export function useWeeklySchedule(courtId?: string, weekStart?: string, surfaceId?: string, enabled = true) {
  return useQuery({
    queryKey: weeklyScheduleQueryKey(courtId, weekStart, surfaceId),
    queryFn: () => bookingScheduleApi.weekly(courtId!, weekStart, surfaceId),
    enabled: Boolean(courtId) && enabled,
    staleTime: 30_000,    // 30s — data is relatively stable per week
    gcTime: 5 * 60_000,   // 5 min — keep cached data for faster back navigation
    refetchInterval: false, // disable polling; rely on Socket.IO realtime invalidation
    refetchOnWindowFocus: false,
    placeholderData: (previousData, previousQuery) => {
      const prevSurfaceId = previousQuery?.queryKey?.[3];
      const targetSurfaceId = surfaceId ?? "ALL";
      if (prevSurfaceId === targetSurfaceId) {
        return previousData;
      }
      return undefined;
    }
  });
}

/** Prefetch previous and next weeks for instant navigation */
export function usePrefetchAdjacentWeeks(courtId: string | undefined, currentWeekStart: string, surfaceId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!courtId) return;

    const current = new Date(`${currentWeekStart}T00:00:00`);
    const prev = new Date(current);
    prev.setDate(current.getDate() - 7);
    const next = new Date(current);
    next.setDate(current.getDate() + 7);

    const targets = [formatYmdLocal(prev), formatYmdLocal(next)];

    for (const target of targets) {
      queryClient.prefetchQuery({
        queryKey: weeklyScheduleQueryKey(courtId, target, surfaceId),
        queryFn: () => bookingScheduleApi.weekly(courtId, target, surfaceId),
        staleTime: 30_000,
        gcTime: 5 * 60_000
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtId, currentWeekStart, surfaceId]);
}

function formatYmdLocal(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
