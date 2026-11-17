import { useQuery } from "@tanstack/react-query";
import { courtApi, type CourtFilters } from "../api/courtApi";

export function useCourts(filters: CourtFilters) {
  return useQuery({ queryKey: ["courts", filters], queryFn: () => courtApi.list(filters), refetchInterval: 45000, refetchOnWindowFocus: true });
}

export function useCourt(id?: string) {
  return useQuery({ queryKey: ["court", id], queryFn: () => courtApi.detail(id!), enabled: Boolean(id) });
}

export function useCourtAvailability(id?: string, date?: string) {
  return useQuery({
    queryKey: ["court-availability", id, date],
    queryFn: () => courtApi.availability(id!, date!),
    enabled: Boolean(id && date)
  });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: courtApi.categories });
}

export function useSportTypes() {
  return useQuery({ queryKey: ["sport-types"], queryFn: courtApi.sportTypes });
}
