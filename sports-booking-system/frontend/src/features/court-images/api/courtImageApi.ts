import { api } from "../../../lib/axios";
import type { ApiResponse } from "../../../types/api";

export type CourtImageRequest = {
  id: string;
  courtId: string;
  imageUrl: string;
  previousImageUrl: string | null;
  replaceImageId: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  court: { id: string; name: string };
};

export const courtImageApi = {
  async list(courtId: string) {
    return (await api.get<ApiResponse<CourtImageRequest[]>>(`/partner/courts/${courtId}/image-requests`)).data.data;
  },
  async pending() {
    return (await api.get<ApiResponse<CourtImageRequest[]>>("/admin/court-image-requests")).data.data;
  },
  async cancel(id: string) {
    return api.post(`/partner/image-requests/${id}/cancel`);
  },
  async review(id: string, decision: "APPROVED" | "REJECTED", reason?: string) {
    return api.post(`/admin/court-image-requests/${id}/review`, { decision, reason });
  }
};
