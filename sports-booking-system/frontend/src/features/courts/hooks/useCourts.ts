import { useQuery } from "@tanstack/react-query";
import { courtApi, type CourtFilters } from "../api/courtApi";

export function useCourts(filters: CourtFilters) {
  return useQuery({
    queryKey: ["courts", filters],
    queryFn: () => courtApi.list(filters),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true
  });
}

export function useCourt(id?: string) {
  return useQuery({
    queryKey: ["court", id],
    queryFn: () => courtApi.detail(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true
  });
}

export function useCourtAvailability(id?: string, date?: string) {
  return useQuery({
    queryKey: ["court-availability", id, date],
    queryFn: () => courtApi.availability(id!, date!),
    enabled: Boolean(id && date),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: courtApi.categories,
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000
  });
}

export function useSportTypes() {
  return useQuery({
    queryKey: ["sport-types"],
    queryFn: courtApi.sportTypes,
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000
  });
}
