import { api } from "../../../lib/axios";
import type { ApiResponse, Category, Court, Paginated } from "../../../types/api";

export type CourtFilters = {
  q?: string;
  city?: string;
  district?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
};

export const courtApi = {
  async list(filters: CourtFilters = {}) {
    const { data } = await api.get<ApiResponse<Paginated<Court>>>("/courts", { params: filters });
    return data.data;
  },
  async detail(id: string) {
    const { data } = await api.get<ApiResponse<Court>>(`/courts/${id}`);
    return data.data;
  },
  async availability(id: string, date: string) {
    const { data } = await api.get<ApiResponse<{ bookedSlots: Array<{ id: string; startTime: string; endTime: string }> }>>(
      `/courts/${id}/availability`,
      { params: { date } }
    );
    return data.data;
  },
  async categories() {
    const { data } = await api.get<ApiResponse<Category[]>>("/categories");
    return data.data;
  },
  async reviews(id: string) {
    const { data } = await api.get<ApiResponse<Array<{ id: string; rating: number; comment?: string; user: { fullName: string } }>>>(
      `/courts/${id}/reviews`
    );
    return data.data;
  }
};
