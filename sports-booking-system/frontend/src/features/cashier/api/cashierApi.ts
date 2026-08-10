import { api } from "../../../lib/axios";
import type { ApiResponse } from "../../../types/api";

export interface ActiveBookingService {
  id: string;
  bookingId: string;
  serviceId?: string | null;
  courtServiceId?: string | null;
  quantity: number;
  price: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  addedBy: string;
  service?: {
    id: string;
    name: string;
    type: "PRODUCT" | "RENTAL_SERVICE";
    unit: string;
  } | null;
  rentalItems?: Array<{
    id: string;
    status: "RENTED" | "RETURNED" | "DAMAGED" | "LOST";
    rentalStartTime: string;
    returnedAt?: string | null;
  }>;
}

export interface CashierBooking {
  id: string;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  paymentStatus: string;
  totalPrice: number;
  depositAmount: number;
  courtSubtotal: number;
  serviceSubtotal: number;
  totalAmount: number;
  depositPaid: number;
  remainingAmount: number;
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
  services: ActiveBookingService[];
}

export interface CashierBookingDetail {
  booking: CashierBooking;
  courtSubtotal: number;
  serviceSubtotal: number;
  voucherDiscount: number;
  grandTotal: number;
  depositPaid: number;
  remainingAmount: number;
  activeServices: ActiveBookingService[];
}

export const cashierApi = {
  async getActiveBookings(courtId?: string) {
    const res = await api.get<ApiResponse<CashierBooking[]>>("/cashier/bookings/active", { params: { courtId } });
    return res.data.data;
  },

  async getBookingDetail(bookingId: string) {
    const res = await api.get<ApiResponse<CashierBookingDetail>>(`/cashier/bookings/${bookingId}`);
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

  async returnRentalItem(rentalItemId: string, status: "RETURNED" | "DAMAGED" | "LOST", notes?: string) {
    const res = await api.post<ApiResponse<any>>("/cashier/rentals/return", { rentalItemId, status, notes });
    return res.data.data;
  }
};
