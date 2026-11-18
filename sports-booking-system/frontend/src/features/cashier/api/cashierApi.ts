import { api } from "../../../lib/axios";
import type { ApiResponse } from "../../../types/api";

export interface ActiveBookingService {
  id: string;
  bookingId: string;
  serviceId?: string | null;
  courtServiceId?: string | null;
  name?: string;
  unit?: string;
  imageUrl?: string | null;
  quantity: number;
  price: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  addedBy?: string;
  service?: {
    id: string;
    name: string;
    type: "PRODUCT" | "RENTAL_SERVICE";
    unit: string;
    imageUrl?: string | null;
  } | null;
  rentalItems?: Array<{
    id: string;
    status: "RENTED" | "RETURNED" | "DAMAGED" | "LOST";
    rentalStartTime: string;
    returnedAt?: string | null;
  }>;
}

/** What was paid before the session (online or a deposit) covered: nothing, part of the court, or all of it. */
export type PrepaidKind = "NONE" | "DEPOSIT" | "COURT_FULL";

export interface CashierBooking {
  id: string;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentMethod?: string;
  totalPrice: number;
  depositAmount: number;
  courtSubtotal: number;
  serviceSubtotal: number;
  voucherDiscount?: number;
  totalAmount: number;
  depositPaid: number;
  /** Collected at the counter so far, on top of depositPaid. */
  paidAtCounter?: number;
  prepaidKind?: PrepaidKind;
  remainingAmount: number;
  checkedInAt?: string | null;
  /** Locked at the counter: services cannot change until it is unlocked (on every device). */
  invoiceLockedAt?: string | null;
  user: {
    id: string;
    fullName: string;
    phone?: string | null;
    email: string;
  };
  court: {
    id: string;
    name: string;
  };
  courtSurface?: {
    id: string;
    name: string;
    code?: string;
  } | null;
  services: ActiveBookingService[];
}

export interface CashierBookingDetail {
  booking: CashierBooking;
  courtSubtotal: number;
  serviceSubtotal: number;
  voucherDiscount: number;
  grandTotal: number;
  depositPaid: number;
  paidAtCounter: number;
  prepaidKind: PrepaidKind;
  remainingAmount: number;
  activeServices: ActiveBookingService[];
}

export const cashierApi = {
  async getActiveBookings(courtId?: string, search?: string, filter?: string) {
    const res = await api.get<ApiResponse<CashierBooking[]>>("/cashier/bookings/active", {
      params: { courtId: courtId || undefined, search: search || undefined, filter: filter || undefined }
    });
    return res.data.data;
  },

  async getBookingDetail(bookingId: string) {
    const res = await api.get<ApiResponse<CashierBookingDetail>>(`/cashier/bookings/${bookingId}`);
    return res.data.data;
  },

  async checkInBooking(bookingId: string) {
    const res = await api.post<ApiResponse<any>>(`/cashier/bookings/${bookingId}/check-in`);
    return res.data.data;
  },

  async addServiceToBooking(bookingId: string, serviceId: string, quantity = 1) {
    const res = await api.post<ApiResponse<{ result: ActiveBookingService; totals: CashierBookingDetail }>>(`/cashier/bookings/${bookingId}/services`, {
      serviceId,
      quantity
    });
    return res.data.data;
  },

  async updateServiceQuantity(bookingId: string, serviceId: string, quantity: number) {
    const res = await api.patch<ApiResponse<{ result: ActiveBookingService | null; totals: CashierBookingDetail }>>(`/cashier/bookings/${bookingId}/services/${serviceId}`, {
      quantity
    });
    return res.data.data;
  },

  async removeServiceFromBooking(bookingId: string, serviceId: string) {
    const res = await api.delete<ApiResponse<{ result: null; totals: CashierBookingDetail }>>(`/cashier/bookings/${bookingId}/services/${serviceId}`);
    return res.data.data;
  },

  async setInvoiceLock(bookingId: string, locked: boolean) {
    const res = locked
      ? await api.post<ApiResponse<{ invoiceLockedAt: string | null }>>(`/cashier/bookings/${bookingId}/invoice-lock`)
      : await api.delete<ApiResponse<{ invoiceLockedAt: string | null }>>(`/cashier/bookings/${bookingId}/invoice-lock`);
    return res.data.data;
  },
  /** Ends a checked-in session that owes nothing; with money owed, taking the payment finishes it instead. */
  async finishSession(bookingId: string) {
    const res = await api.post<ApiResponse<{ id: string; bookingStatus: "COMPLETED" }>>(`/cashier/bookings/${bookingId}/finish`);
    return res.data.data;
  },
  async returnRentalItem(rentalItemId: string, status: "RETURNED" | "DAMAGED" | "LOST", notes?: string) {
    const res = await api.post<ApiResponse<any>>("/cashier/rentals/return", { rentalItemId, status, notes });
    return res.data.data;
  }
};
