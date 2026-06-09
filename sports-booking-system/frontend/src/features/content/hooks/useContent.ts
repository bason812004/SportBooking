import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../api/contentApi";

export function useVouchers() {
  return useQuery({ queryKey: ["public-vouchers"], queryFn: contentApi.vouchers });
}

export function useBlogs() {
  return useQuery({ queryKey: ["public-blogs"], queryFn: contentApi.blogs });
}

export function useTournaments() {
  return useQuery({ queryKey: ["public-tournaments"], queryFn: contentApi.tournaments });
}
