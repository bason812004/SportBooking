import { api } from "../../../lib/axios";
import type { ApiResponse, Booking, Court } from "../../../types/api";

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
  async bookings() {
    const { data } = await api.get<ApiResponse<{ items: Booking[] }>>("/partner/bookings");
    return data.data;
  },
  async setBookingStatus(id: string, action: "confirm" | "reject" | "complete" | "no-show") {
    const { data } = await api.put<ApiResponse<Booking>>(`/partner/bookings/${id}/${action}`);
    return data.data;
  },
  async revenue() {
    const { data } = await api.get<ApiResponse<unknown[]>>("/partner/statistics/revenue");
    return data.data;
  }
};
