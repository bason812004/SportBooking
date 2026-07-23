import { api, cleanParams } from "./client";
import type { ApiResponse, BlogPost, Tournament } from "./types";

export const contentApi = {
  async blogs(params: { search?: string } = {}) {
    const { data } = await api.get<ApiResponse<BlogPost[]>>("/blogs", { params: cleanParams(params) });
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
  async registerTournament(id: string, payload: { teamName?: string; contactPhone: string; note?: string }) {
    const { data } = await api.post<ApiResponse<unknown>>(`/tournaments/${id}/register`, payload);
    return data.data;
  }
};
