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
  }
};
