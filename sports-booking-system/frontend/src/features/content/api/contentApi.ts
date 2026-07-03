import { api } from "../../../lib/axios";
import { repairObject } from "../../../lib/text";
import type { ApiResponse, BlogComment, BlogPost, TeamRecruitmentInput, TeamRecruitmentPost, Tournament, Voucher } from "../../../types/api";

export type BlogWriteInput = {
  title: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  visibility: "PUBLIC" | "PRIVATE";
};

export const contentApi = {
  async vouchers() {
    const { data } = await api.get<ApiResponse<Voucher[]>>("/vouchers");
    return repairObject(data.data);
  },

  async blogs() {
    const { data } = await api.get<ApiResponse<BlogPost[]>>("/blogs");
    return repairObject(data.data);
  },

  async blog(slug: string) {
    const { data } = await api.get<ApiResponse<BlogPost>>(`/blogs/${slug}`);
    return repairObject(data.data);
  },

  async blogComments(slug: string) {
    const { data } = await api.get<ApiResponse<BlogComment[]>>(`/blogs/${slug}/comments`);
    return repairObject(data.data);
  },

  async createBlogComment(slug: string, content: string) {
    const { data } = await api.post<ApiResponse<BlogComment>>(`/blogs/${slug}/comments`, { content });
    return repairObject(data.data);
  },

  async myBlogs() {
    const { data } = await api.get<ApiResponse<BlogPost[]>>("/blogs/me");
    return repairObject(data.data);
  },

  async myBlog(id: string) {
    const { data } = await api.get<ApiResponse<BlogPost>>(`/blogs/me/${id}`);
    return repairObject(data.data);
  },

  async createBlog(input: BlogWriteInput) {
    const { data } = await api.post<ApiResponse<BlogPost>>("/blogs/me", input);
    return repairObject(data.data);
  },

  async updateBlog(id: string, input: BlogWriteInput) {
    const { data } = await api.put<ApiResponse<BlogPost>>(`/blogs/me/${id}`, input);
    return repairObject(data.data);
  },

  async deleteBlog(id: string) {
    const { data } = await api.delete<ApiResponse<{ deleted: boolean }>>(`/blogs/me/${id}`);
    return data.data;
  },

  async trackVoucherClick(id: string) {
    const { data } = await api.post<ApiResponse<{ id: string; clickCount: number }>>(`/vouchers/${id}/click`);
    return data.data;
  },

  async tournaments() {
    const { data } = await api.get<ApiResponse<Tournament[]>>("/tournaments");
    return repairObject(data.data);
  },

  async tournament(slug: string) {
    const { data } = await api.get<ApiResponse<Tournament>>(`/tournaments/${slug}`);
    return repairObject(data.data);
  },

  async teamPosts() {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost[]>>("/team-posts");
    return repairObject(data.data);
  },

  async teamPost(id: string) {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}`);
    return repairObject(data.data);
  },

  async myTeamPosts() {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost[]>>("/team-posts/me");
    return repairObject(data.data);
  },

  async createTeamPost(input: TeamRecruitmentInput) {
    const { data } = await api.post<ApiResponse<TeamRecruitmentPost>>("/team-posts", input);
    return repairObject(data.data);
  },

  async updateTeamPost(id: string, input: TeamRecruitmentInput) {
    const { data } = await api.put<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}`, input);
    return repairObject(data.data);
  },

  async deleteTeamPost(id: string) {
    const { data } = await api.delete<ApiResponse<{ deleted: boolean }>>(`/team-posts/${id}`);
    return data.data;
  },

  async joinTeamPost(id: string) {
    const { data } = await api.post<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}/join`);
    return data.data;
  }
};
