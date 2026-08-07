import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../api/contentApi";

const realtimeQuery = { staleTime: 60000, gcTime: 300000, refetchInterval: 60000, refetchOnWindowFocus: false };

export function useVouchers() {
  return useQuery({ queryKey: ["public-vouchers"], queryFn: contentApi.vouchers, ...realtimeQuery });
}

export function useBlogs(search = "") {
  return useQuery({ queryKey: ["public-blogs", search], queryFn: () => contentApi.blogs({ search }), ...realtimeQuery });
}

export function useBlog(slug?: string) {
  return useQuery({ queryKey: ["public-blog", slug], queryFn: () => contentApi.blog(slug!), enabled: Boolean(slug), staleTime: 60000, gcTime: 300000 });
}

export function useBlogComments(slug?: string) {
  return useQuery({ queryKey: ["blog-comments", slug], queryFn: () => contentApi.blogComments(slug!), enabled: Boolean(slug), staleTime: 30000 });
}

export function useMyBlogs() {
  return useQuery({ queryKey: ["my-blogs"], queryFn: contentApi.myBlogs, staleTime: 30000 });
}

export function useMyBlog(id?: string) {
  return useQuery({ queryKey: ["my-blog", id], queryFn: () => contentApi.myBlog(id!), enabled: Boolean(id), staleTime: 30000 });
}

export function useTournaments() {
  return useQuery({ queryKey: ["public-tournaments"], queryFn: contentApi.tournaments, ...realtimeQuery });
}

export function useTournament(slug?: string) {
  return useQuery({ queryKey: ["public-tournament", slug], queryFn: () => contentApi.tournament(slug!), enabled: Boolean(slug), staleTime: 60000 });
}

export function useTeamPosts() {
  return useQuery({ queryKey: ["team-posts"], queryFn: contentApi.teamPosts, ...realtimeQuery });
}

export function useMyTeamPosts() {
  return useQuery({ queryKey: ["my-team-posts"], queryFn: contentApi.myTeamPosts, staleTime: 30000 });
}

export function useJoinedTeamPosts() {
  return useQuery({ queryKey: ["joined-team-posts"], queryFn: contentApi.joinedTeamPosts, staleTime: 60000 });
}

export function useTeamPost(id?: string) {
  return useQuery({ queryKey: ["team-post", id], queryFn: () => contentApi.teamPost(id!), enabled: Boolean(id), staleTime: 60000 });
}

export function useTeamPostMessages(id?: string, enabled = true) {
  return useQuery({
    queryKey: ["team-post-messages", id],
    queryFn: () => contentApi.teamPostMessages(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 60000
  });
}
