import { api } from "../../../lib/axios";
import type { ApiResponse, Booking, MyVoucher, Paginated, Voucher, VoucherValidatePayload, VoucherValidateResult } from "../../../types/api";

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
  date?: string;
  startTime: string;
  endTime: string;
  courtSurfaceId?: string;
  courtSubId?: string;
};

export type BookingDayPayload = {
  bookingDate: string;
  slots: BookingSlotPayload[];
};

export type BookingQuotePayload = {
  courtId: string;
  days: BookingDayPayload[];
  services?: Array<{ serviceId: string; quantity: number }>;
  voucherId?: string;
  voucherCode?: string;
};

export type BookingQuote = {
  court: { id: string; name: string; address: string; imageUrl?: string | null };
  days: Array<{
    bookingDate: string;
    slots: Array<BookingSlotPayload & { price: number }>;
    courtSubtotal: number;
    subtotal: number;
    voucherDiscountAmount: number;
    totalAmount: number;
  }>;
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
  orderId?: string;
  bookingId: string;
  bookings?: Array<{ bookingId: string; bookingDate: string; totalAmount: number }>;
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
  providerConfigured?: boolean;
  bookingCount?: number;
  isMultiBooking?: boolean;
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
  },
  async getBill(bookingId: string) {
    const { data } = await api.get<ApiResponse<BookingBill>>(`/bookings/${bookingId}/bill`);
    return data.data;
  },
  async getServices(bookingId: string) {
    const { data } = await api.get<ApiResponse<BookingBill["services"]>>(`/bookings/${bookingId}/services`);
    return data.data;
  },
  async addService(bookingId: string, payload: { serviceId: string; quantity: number }) {
    const { data } = await api.post<ApiResponse<any>>(`/bookings/${bookingId}/services`, payload);
    return data.data;
  },
  async updateService(bookingId: string, serviceId: string, quantity: number) {
    const { data } = await api.patch<ApiResponse<any>>(`/bookings/${bookingId}/services/${serviceId}`, { quantity });
    return data.data;
  },
  async removeService(bookingId: string, serviceId: string) {
    const { data } = await api.delete<ApiResponse<any>>(`/bookings/${bookingId}/services/${serviceId}`);
    return data.data;
  },
  async listAvailableServices(params?: { courtId?: string; categoryId?: string; sportType?: string; search?: string }) {
    const { data } = await api.get<ApiResponse<AvailableService[]>>(`/services`, { params });
    return data.data;
  }
};

export type BookingBill = {
  bookingId: string;
  bookingCode: string;
  bookingStatus: string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID" | "OVERDUE";
  court: {
    id: string;
    name: string;
    address: string;
  };
  user?: {
    id: string;
    fullName: string;
    phone: string;
    email: string;
  };
  bookingDate: string;
  startTime: string;
  endTime: string;
  services: Array<{
    id: string;
    serviceId: string;
    name: string;
    category?: string;
    unit?: string;
    imageUrl?: string | null;
    price: number;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    status: string;
  }>;
  subtotalCourt: number;
  serviceSubtotal: number;
  voucherDiscount: number;
  depositPaid: number;
  totalPaid: number;
  remainingAmount: number;
  totalAmount: number;
  grandTotal: number;
  isFullyPaid: boolean;
  checkoutId?: string;
  checkoutStatus?: string;
  payments?: any[];
};

export type AvailableService = {
  id: string;
  courtId?: string;
  categoryId?: string;
  categoryName?: string;
  name: string;
  description?: string;
  type: string;
  sportType?: string;
  price: number;
  originalPrice?: number;
  unit: string;
  imageUrl?: string | null;
  status: string;
  trackInventory?: boolean;
  stock?: number;
  inventoryQuantity?: number;
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
