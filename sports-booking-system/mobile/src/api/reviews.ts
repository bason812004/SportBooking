import { api } from "./client";
import type { ApiResponse, Court } from "./types";

export type CourtReview = NonNullable<Court["reviews"]>[number];

export const reviewApi = {
  async create(payload: { courtId: string; bookingId?: string | null; rating: number; comment?: string | null }) {
    const { data } = await api.post<ApiResponse<CourtReview>>("/reviews", payload);
    return data.data;
  }
};

