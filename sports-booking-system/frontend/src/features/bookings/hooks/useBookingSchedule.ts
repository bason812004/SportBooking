import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/axios";
import type { ApiResponse, WeeklyScheduleResponse } from "../../../types/api";

export const bookingScheduleApi = {
  async weekly(courtId: string, weekStart?: string) {
    const params = weekStart ? { weekStart } : undefined;
    const { data } = await api.get<ApiResponse<WeeklyScheduleResponse>>(
      `/courts/${courtId}/weekly-schedule`,
      { params }
    );
    return data.data;
  }
};

export const weeklyScheduleQueryKey = (courtId: string | undefined, weekStart: string | undefined) =>
  ["weekly-schedule", courtId, weekStart ?? "current"] as const;

export function useWeeklySchedule(courtId?: string, weekStart?: string, enabled = true) {
  return useQuery({
    queryKey: weeklyScheduleQueryKey(courtId, weekStart),
    queryFn: () => bookingScheduleApi.weekly(courtId!, weekStart),
    enabled: Boolean(courtId) && enabled,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 10000
  });
}

export function usePrefetchAdjacentWeeks(courtId: string | undefined, currentWeekStart: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!courtId) return;
    const current = new Date(`${currentWeekStart}T00:00:00`);
    const prev = new Date(current);
    prev.setDate(current.getDate() - 7);
    const next = new Date(current);
    next.setDate(current.getDate() + 7);

    const targets = [
      formatYmdLocal(prev),
      formatYmdLocal(next)
    ];

    for (const target of targets) {
      queryClient.prefetchQuery({
        queryKey: weeklyScheduleQueryKey(courtId, target),
        queryFn: () => bookingScheduleApi.weekly(courtId, target),
        staleTime: 30000
      });
    }
  }, [courtId, currentWeekStart, queryClient]);
}

function formatYmdLocal(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}