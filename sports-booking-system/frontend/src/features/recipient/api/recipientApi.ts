import { api } from "../../../lib/axios";
import type { ApiResponse, Booking, Paginated } from "../../../types/api";

export type RecipientDashboard = {
  courtName: string;
  bookingsToday: number;
  pendingBookings: number;
  revenue: number;
  recentBookings: Array<{
    id: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    totalPrice: number;
    bookingStatus: string;
    user: {
      fullName: string;
      email: string;
    };
  }>;
};

export const recipientApi = {
  async dashboard() {
    const { data } = await api.get<ApiResponse<RecipientDashboard>>("/recipient/dashboard");
    return data.data;
  },

  async bookings(params: { page?: number; limit?: number; status?: string; fromDate?: string; toDate?: string }) {
    const { data } = await api.get<ApiResponse<Paginated<Booking>>>("/recipient/bookings", { params });
    return data.data;
  },

  async confirmBooking(id: string) {
    const { data } = await api.put<ApiResponse<Booking>>(`/recipient/bookings/${id}/confirm`);
    return data.data;
  },

  async rejectBooking(id: string) {
    const { data } = await api.put<ApiResponse<Booking>>(`/recipient/bookings/${id}/reject`);
    return data.data;
  },

  async completeBooking(id: string) {
    const { data } = await api.put<ApiResponse<Booking>>(`/recipient/bookings/${id}/complete`);
    return data.data;
  },

  async noShowBooking(id: string) {
    const { data } = await api.put<ApiResponse<Booking>>(`/recipient/bookings/${id}/no-show`);
    return data.data;
  },

  async calendar(params: { fromDate: string; toDate: string }) {
    const { data } = await api.get<ApiResponse<any[]>>("/recipient/calendar", { params });
    return data.data;
  }
};
