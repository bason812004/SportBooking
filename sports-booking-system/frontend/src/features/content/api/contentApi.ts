import { api } from "../../../lib/axios";
import type { ApiResponse, BlogPost, TeamRecruitmentInput, TeamRecruitmentPost, Tournament, Voucher } from "../../../types/api";

export const contentApi = {
  async vouchers() {
    const { data } = await api.get<ApiResponse<Voucher[]>>("/vouchers");
    return data.data;
  },

  async blogs() {
    const { data } = await api.get<ApiResponse<BlogPost[]>>("/blogs");
    return data.data;
  },

  async blog(slug: string) {
    const { data } = await api.get<ApiResponse<BlogPost>>(`/blogs/${slug}`);
    return data.data;
  },

  async tournaments() {
    const { data } = await api.get<ApiResponse<Tournament[]>>("/tournaments");
    return data.data;
  },

  async tournament(slug: string) {
    const { data } = await api.get<ApiResponse<Tournament>>(`/tournaments/${slug}`);
    return data.data;
  },

  async teamPosts() {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost[]>>("/team-posts");
    return data.data;
  },

  async teamPost(id: string) {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}`);
    return data.data;
  },

  async createTeamPost(input: TeamRecruitmentInput) {
    const { data } = await api.post<ApiResponse<TeamRecruitmentPost>>("/team-posts", input);
    return data.data;
  },

  async joinTeamPost(id: string) {
    const { data } = await api.post<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}/join`);
    return data.data;
  }
};
