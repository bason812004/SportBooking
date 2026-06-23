import { api } from "../../../lib/axios";
import type { ApiResponse, Booking, Paginated } from "../../../types/api";

export type BookingPayload = {
  courtId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "E_WALLET";
  voucherId?: string;
  voucherCode?: string;
  note?: string;
  services: Array<{ serviceId: string; quantity: number }>;
};

export const bookingApi = {
  async create(payload: BookingPayload) {
    const { data } = await api.post<ApiResponse<Booking>>("/bookings", payload);
    return data.data;
  },
  async listMine() {
    const { data } = await api.get<ApiResponse<Paginated<Booking>>>("/users/me/bookings");
    return data.data;
  },
  async detail(id: string) {
    const { data } = await api.get<ApiResponse<Booking>>(`/users/me/bookings/${id}`);
    return data.data;
  },
  async cancel(id: string, cancelReason?: string) {
    const { data } = await api.put<ApiResponse<Booking>>(`/users/me/bookings/${id}/cancel`, { cancelReason });
    return data.data;
  }
};
