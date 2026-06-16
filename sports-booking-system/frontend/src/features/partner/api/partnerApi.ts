import { api } from "../../../lib/axios";
import type { ApiResponse, Booking, Court, PartnerRevenueReport, PartnerVoucher } from "../../../types/api";

export type PartnerVoucherPayload = {
  courtId?: string | null;
  code: string;
  title: string;
  description?: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount?: number | null;
  minBookingAmount: number;
  usageLimit?: number | null;
  startDate: string;
  endDate: string;
};

export const partnerApi = {
  async dashboard() {
    const { data } = await api.get<ApiResponse<{ courts: number; bookings: number; revenue: number }>>("/partner/dashboard");
    return data.data;
  },
  async courts() {
    const { data } = await api.get<ApiResponse<Court[]>>("/partner/courts");
    return data.data;
  },
  async createCourt(payload: Record<string, unknown>) {
    const { data } = await api.post<ApiResponse<Court>>("/partner/courts", payload);
    return data.data;
  },
  async updateCourt(id: string, payload: Record<string, unknown>) {
    const { data } = await api.put<ApiResponse<Court>>(`/partner/courts/${id}`, payload);
    return data.data;
  },
  async addCourtImage(courtId: string, image: File, sortOrder = 0) {
    const formData = new FormData();
    formData.append("image", image);
    formData.append("sortOrder", String(sortOrder));
    const { data } = await api.post<ApiResponse<unknown>>(
      `/partner/courts/${courtId}/images`,
      formData
    );
    return data.data;
  },
  async bookings() {
    const { data } = await api.get<ApiResponse<{ items: Booking[] }>>("/partner/bookings");
    return data.data;
  },
  async setBookingStatus(id: string, action: "confirm" | "reject" | "complete" | "no-show") {
    const { data } = await api.put<ApiResponse<Booking>>(`/partner/bookings/${id}/${action}`);
    return data.data;
  },
  async revenue(month: string) {
    const { data } = await api.get<ApiResponse<PartnerRevenueReport>>("/partner/statistics/revenue", {
      params: { month }
    });
    return data.data;
  },
  async vouchers() {
    const { data } = await api.get<ApiResponse<PartnerVoucher[]>>("/partner/vouchers");
    return data.data;
  },
  async voucherDetail(id: string) {
    const { data } = await api.get<ApiResponse<PartnerVoucher>>(`/partner/vouchers/${id}`);
    return data.data;
  },
  async createVoucher(payload: PartnerVoucherPayload) {
    const { data } = await api.post<ApiResponse<PartnerVoucher>>("/partner/vouchers", payload);
    return data.data;
  },
  async updateVoucher(id: string, payload: PartnerVoucherPayload) {
    const { data } = await api.put<ApiResponse<PartnerVoucher>>(`/partner/vouchers/${id}`, payload);
    return data.data;
  },
  async activateVoucher(id: string) {
    const { data } = await api.put<ApiResponse<PartnerVoucher>>(`/partner/vouchers/${id}/activate`);
    return data.data;
  },
  async disableVoucher(id: string) {
    const { data } = await api.put<ApiResponse<PartnerVoucher>>(`/partner/vouchers/${id}/disable`);
    return data.data;
  },
  async deleteVoucher(id: string) {
    const { data } = await api.delete<ApiResponse<{ id: string }>>(`/partner/vouchers/${id}`);
    return data.data;
  }
};
