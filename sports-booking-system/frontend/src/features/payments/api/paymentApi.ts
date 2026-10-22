import { api } from "../../../lib/axios";
import type { ApiResponse, Booking } from "../../../types/api";

export type OrderBookingItem = {
  id: string;
  bookingCode: string;
  bookingDate: string;
  totalPrice?: string | number;
  court: { id: string; name: string; address: string };
  bookingSlots?: Array<{
    id: string;
    startTime: string;
    endTime: string;
    slotPrice: string;
    court_surfaces?: { id?: string; name?: string } | null;
  }>;
  bookingServices?: Array<{
    id: string;
    quantity: number;
    totalPrice: string | number;
    service?: { id?: string; name: string; price?: string | number };
  }>;
};

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
  orderBookings?: OrderBookingItem[] | null;
  booking: Booking & {
    bookingSlots?: Array<{
      id: string;
      startTime: string;
      endTime: string;
      slotPrice: string;
      bookingDate?: string;
      courtName?: string;
      court_surfaces?: { id?: string; name?: string } | null;
    }>;
    bookingServices?: Array<{
      id: string;
      quantity: number;
      totalPrice: string | number;
      service?: { id?: string; name: string; price?: string | number };
    }>;
  };
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
  }
};
