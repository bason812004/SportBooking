import { useQuery } from "@tanstack/react-query";
import { courtApi, type CourtFilters } from "../api/courtApi";

export function useCourts(filters: CourtFilters) {
  return useQuery({ queryKey: ["courts", filters], queryFn: () => courtApi.list(filters) });
}

export function useCourt(id?: string) {
  return useQuery({ queryKey: ["court", id], queryFn: () => courtApi.detail(id!), enabled: Boolean(id) });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: courtApi.categories });
}
