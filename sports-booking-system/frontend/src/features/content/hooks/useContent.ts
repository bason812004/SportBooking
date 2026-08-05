import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../api/contentApi";

const realtimeQuery = { refetchInterval: 45000, refetchOnWindowFocus: true };

export function useVouchers() {
  return useQuery({ queryKey: ["public-vouchers"], queryFn: contentApi.vouchers, ...realtimeQuery });
}

export function useBlogs(search = "") {
  return useQuery({ queryKey: ["public-blogs", search], queryFn: () => contentApi.blogs({ search }), ...realtimeQuery });
}

export function useBlog(slug?: string) {
  return useQuery({ queryKey: ["public-blog", slug], queryFn: () => contentApi.blog(slug!), enabled: Boolean(slug), refetchOnMount: "always", refetchOnWindowFocus: true });
}

export function useBlogComments(slug?: string) {
  return useQuery({ queryKey: ["blog-comments", slug], queryFn: () => contentApi.blogComments(slug!), enabled: Boolean(slug) });
}

export function useMyBlogs() {
  return useQuery({ queryKey: ["my-blogs"], queryFn: contentApi.myBlogs });
}

export function useMyBlog(id?: string) {
  return useQuery({ queryKey: ["my-blog", id], queryFn: () => contentApi.myBlog(id!), enabled: Boolean(id) });
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

export function useMyTeamPosts() {
  return useQuery({ queryKey: ["my-team-posts"], queryFn: contentApi.myTeamPosts });
}

export function useJoinedTeamPosts() {
  return useQuery({ queryKey: ["joined-team-posts"], queryFn: contentApi.joinedTeamPosts });
}

export function useTeamPost(id?: string) {
  return useQuery({ queryKey: ["team-post", id], queryFn: () => contentApi.teamPost(id!), enabled: Boolean(id) });
}

export function useTeamPostMessages(id?: string, enabled = true) {
  return useQuery({
    queryKey: ["team-post-messages", id],
    queryFn: () => contentApi.teamPostMessages(id!),
    enabled: Boolean(id) && enabled
  });
}
