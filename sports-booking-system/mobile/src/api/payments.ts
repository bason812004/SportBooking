import { api } from "./client";
import type { ApiResponse, Booking } from "./types";

export type PaymentDetail = {
  id: string;
  bookingId: string;
  provider: string;
  paymentMethod: string;
  paymentType: "DEPOSIT" | "FULL_PAYMENT" | "REMAINING_PAYMENT";
  amount: string;
  currency: "VND";
  status: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";
  qrCodeUrl?: string | null;
  qrPayload?: string | null;
  paymentReference: string;
  expiresAt: string;
  paidAt?: string | null;
  booking: Booking;
};

export type PaymentStatus = {
  id: string;
  bookingId: string;
  status: PaymentDetail["status"];
  bookingStatus: string;
  amount: number;
  expiresAt: string;
  paidAt?: string | null;
};

export const paymentApi = {
  async detail(paymentId: string) {
    const { data } = await api.get<ApiResponse<PaymentDetail>>(`/payments/${paymentId}`);
    return data.data;
  },
  async status(paymentId: string) {
    const { data } = await api.get<ApiResponse<PaymentStatus>>(`/payments/${paymentId}/status`);
    return data.data;
  },
  // Dev-only shortcut (backend rejects this outside development) so testers can complete a
  // booking payment without scanning a real QR code.
  async devComplete(paymentId: string) {
    const { data } = await api.post<ApiResponse<{ ok: boolean }>>(`/payments/${paymentId}/dev-complete`);
    return data.data;
  }
};

