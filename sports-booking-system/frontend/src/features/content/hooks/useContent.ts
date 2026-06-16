import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../api/contentApi";

export function useVouchers() {
  return useQuery({ queryKey: ["public-vouchers"], queryFn: contentApi.vouchers });
}

export function useBlogs() {
  return useQuery({ queryKey: ["public-blogs"], queryFn: contentApi.blogs });
}

export function useBlog(slug?: string) {
  return useQuery({ queryKey: ["public-blog", slug], queryFn: () => contentApi.blog(slug!), enabled: Boolean(slug) });
}

export function useTournaments() {
  return useQuery({ queryKey: ["public-tournaments"], queryFn: contentApi.tournaments });
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
