import { api } from "../../../lib/axios";
import type { ApiResponse } from "../../../types/api";

export const reviewApi = {
  async create(payload: { bookingId: string; rating: number; comment?: string }) {
    const { data } = await api.post<ApiResponse<unknown>>("/reviews", payload);
    return data.data;
  },
  async report(payload: { courtId: string; reason: string; description?: string }) {
    const { data } = await api.post<ApiResponse<unknown>>("/reports", payload);
    return data.data;
  }
};
