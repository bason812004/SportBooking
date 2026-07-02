import { api } from "../../../lib/axios";
import { repairObject } from "../../../lib/text";
import type { ApiResponse, BlogPost, TeamRecruitmentInput, TeamRecruitmentPost, Tournament, Voucher } from "../../../types/api";

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

  async createTeamPost(input: TeamRecruitmentInput) {
    const { data } = await api.post<ApiResponse<TeamRecruitmentPost>>("/team-posts", input);
    return data.data;
  },

  async joinTeamPost(id: string) {
    const { data } = await api.post<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}/join`);
    return data.data;
  }
};
