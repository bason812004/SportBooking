import { api } from "./client";
import type { ApiResponse } from "./types";

export type PartnerDashboard = {
  totalCourts: number;
  totalBookings: number;
  totalRevenue: number;
  occupancyRate?: number;
  recentBookings?: any[];
};

export const partnerApi = {
  async dashboard() {
    const { data } = await api.get<ApiResponse<PartnerDashboard>>("/partner/dashboard");
    return data.data;
  },

  async courts() {
    const { data } = await api.get<ApiResponse<any[]>>("/partner/courts");
    return data.data;
  },

  async createCourt(payload: any) {
    const { data } = await api.post<ApiResponse<any>>("/partner/courts", payload);
    return data.data;
  },

  async bookings(query?: { page?: number; limit?: number }) {
    const { data } = await api.get<ApiResponse<{ items: any[]; meta: any }>>("/partner/bookings", { params: query });
    return data.data;
  },

  async revenue(month?: string) {
    const { data } = await api.get<ApiResponse<any>>("/partner/revenue", { params: { month } });
    return data.data;
  },

  async vouchers() {
    const { data } = await api.get<ApiResponse<any[]>>("/partner/vouchers");
    return data.data;
  },

  async createVoucher(payload: any) {
    const { data } = await api.post<ApiResponse<any>>("/partner/vouchers", payload);
    return data.data;
  },

  async tournaments() {
    const { data } = await api.get<ApiResponse<any[]>>("/partner/tournaments");
    return data.data;
  }
};
