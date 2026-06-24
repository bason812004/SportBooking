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

export type BookingSlotPayload = {
  startTime: string;
  endTime: string;
};

export type BookingQuotePayload = {
  courtId: string;
  bookingDate: string;
  slots: BookingSlotPayload[];
  voucherCode?: string;
};

export type BookingQuote = {
  court: { id: string; name: string; address: string; imageUrl?: string | null };
  bookingDate: string;
  slots: Array<BookingSlotPayload & { price: number }>;
  subtotal: number;
  voucherDiscountAmount: number;
  totalAmount: number;
  minimumDepositAmount: number;
  remainingAmount: number;
  currency: "VND";
  quoteExpiresAt: string;
};

export type BookingCheckoutPayload = BookingQuotePayload & {
  paymentType: "DEPOSIT" | "FULL_PAYMENT";
  note?: string;
};

export type BookingCheckoutResult = {
  bookingId: string;
  paymentId: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentType: "DEPOSIT" | "FULL_PAYMENT";
  totalAmount: number;
  paymentAmount: number;
  remainingAmount: number;
  qrCodeUrl?: string | null;
  qrPayload?: string | null;
  paymentReference: string;
  expiresAt: string;
  providerConfigured: boolean;
};

export const bookingApi = {
  async quote(payload: BookingQuotePayload) {
    const { data } = await api.post<ApiResponse<BookingQuote>>("/bookings/quote", payload);
    return data.data;
  },
  async checkout(payload: BookingCheckoutPayload) {
    const { data } = await api.post<ApiResponse<BookingCheckoutResult>>("/bookings/checkout", payload);
    return data.data;
  },
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
