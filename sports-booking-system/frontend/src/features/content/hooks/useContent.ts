import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../api/contentApi";

const realtimeQuery = { refetchInterval: 8000, refetchOnWindowFocus: true };

export function useVouchers() {
  return useQuery({ queryKey: ["public-vouchers"], queryFn: contentApi.vouchers, ...realtimeQuery });
}

export function useBlogs() {
  return useQuery({ queryKey: ["public-blogs"], queryFn: contentApi.blogs, ...realtimeQuery });
}

export function useBlog(slug?: string) {
  return useQuery({ queryKey: ["public-blog", slug], queryFn: () => contentApi.blog(slug!), enabled: Boolean(slug), refetchOnWindowFocus: false, staleTime: Infinity });
}

export function useTournaments() {
  return useQuery({ queryKey: ["public-tournaments"], queryFn: contentApi.tournaments, ...realtimeQuery });
}

export function useTournament(slug?: string) {
  return useQuery({ queryKey: ["public-tournament", slug], queryFn: () => contentApi.tournament(slug!), enabled: Boolean(slug) });
}

export function useTeamPosts() {
  return useQuery({ queryKey: ["team-posts"], queryFn: contentApi.teamPosts });
}

export function useTeamPost(id?: string) {
  return useQuery({ queryKey: ["team-post", id], queryFn: () => contentApi.teamPost(id!), enabled: Boolean(id) });
}
