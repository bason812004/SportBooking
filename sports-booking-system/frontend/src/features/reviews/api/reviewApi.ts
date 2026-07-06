import { api } from "../../../lib/axios";
import type { ApiResponse, Court } from "../../../types/api";

export type CourtReview = NonNullable<Court["reviews"]>[number];

export const reviewApi = {
  async create(payload: { courtId: string; bookingId?: string | null; rating: number; comment?: string | null }) {
    const { data } = await api.post<ApiResponse<CourtReview>>("/reviews", payload);
    return data.data;
  },
  async report(payload: { courtId: string; reason: string; description?: string }) {
    const { data } = await api.post<ApiResponse<unknown>>("/reports", payload);
    return data.data;
  },
  async update(id: string, payload: { rating: number; comment?: string | null }) {
    const { data } = await api.put<ApiResponse<CourtReview>>(`/reviews/${id}`, payload);
    return data.data;
  },
  async delete(id: string) {
    const { data } = await api.delete<ApiResponse<{ deleted: boolean }>>(`/reviews/${id}`);
    return data.data;
  }
};
