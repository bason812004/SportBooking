import { api } from "../../../lib/axios";
import type { ApiResponse, Booking, MyVoucher, Paginated, Voucher, VoucherValidatePayload, VoucherValidateResult } from "../../../types/api";

export type BookingPayload = {
  courtId: string;
  courtSurfaceId?: string;
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
  courtSurfaceId?: string;
  bookingDate: string;
  slots: BookingSlotPayload[];
  services?: Array<{ serviceId: string; quantity: number }>;
  voucherId?: string;
  voucherCode?: string;
};

export type BookingQuote = {
  court: { id: string; name: string; address: string; imageUrl?: string | null };
  courtSurface?: { id: string; code: string; name: string } | null;
  bookingDate: string;
  slots: Array<BookingSlotPayload & { price: number }>;
  services: Array<{ serviceId: string; name: string; quantity: number; price: number; total: number }>;
  courtSubtotal: number;
  servicesSubtotal: number;
  subtotal: number;
  voucherDiscountAmount: number;
  totalAmount: number;
  minimumDepositAmount: number;
  remainingAmount: number;
  depositPercent: number;
  requiresDeposit: boolean;
  currency: "VND";
  quoteExpiresAt: string;
  voucherId?: string;
};

export type BookingCheckoutPayload = BookingQuotePayload & {
  paymentType: "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT";
  note?: string;
};

export type BookingCheckoutResult = {
  bookingId: string;
  paymentId?: string | null;
  bookingStatus: string;
  paymentStatus: string;
  paymentType: "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT";
  totalAmount: number;
  paymentAmount: number;
  remainingAmount: number;
  qrCodeUrl?: string | null;
  qrPayload?: string | null;
  paymentReference?: string;
  expiresAt?: string | null;
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

export const voucherApi = {
  async list() {
    const { data } = await api.get<ApiResponse<Voucher[]>>("/vouchers");
    return data.data;
  },
  async myVouchers() {
    const { data } = await api.get<ApiResponse<MyVoucher[]>>("/vouchers/me");
    return data.data;
  },
  async claim(voucherId: string) {
    const { data } = await api.post<ApiResponse<{ id: string }>>(`/vouchers/${voucherId}/claim`);
    return data.data;
  },
  async validate(payload: VoucherValidatePayload) {
    const { data } = await api.post<ApiResponse<VoucherValidateResult>>("/vouchers/validate", payload);
    return data.data;
  }
};
