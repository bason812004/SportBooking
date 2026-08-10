import { api } from "../../../lib/axios";
import type { ApiResponse } from "../../../types/api";

export interface CheckoutPayment {
  id: string;
  checkoutId: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string | null;
  status: string;
  paidAt: string;
}

export interface CheckoutData {
  checkout: {
    id: string;
    bookingId: string;
    subtotalCourt: number;
    subtotalService: number;
    discount: number;
    depositPaid: number;
    amountPaid: number;
    remainingAmount: number;
    totalAmount: number;
    status: string;
    notes?: string | null;
    payments: CheckoutPayment[];
  };
  booking: {
    id: string;
    bookingCode: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    bookingStatus: string;
    user: { fullName: string; phone?: string | null; email: string };
    court: { id: string; name: string; address: string };
  };
  breakdown: {
    subtotalCourt: number;
    subtotalService: number;
    discount: number;
    depositPaid: number;
    totalPaid: number;
    remainingAmount: number;
    totalAmount: number;
    isFullyPaid: boolean;
  };
}

export const checkoutApi = {
  async getCheckoutByBooking(bookingId: string) {
    const res = await api.get<ApiResponse<CheckoutData>>(`/checkouts/booking/${bookingId}`);
    return res.data.data;
  },

  async processPayment(data: {
    checkoutId: string;
    amount: number;
    paymentMethod: "CASH" | "QR_TRANSFER" | "BANK_TRANSFER" | "E_WALLET";
    transactionId?: string;
  }) {
    const res = await api.post<ApiResponse<{ checkout: CheckoutData["checkout"]; payment: CheckoutPayment; isCompleted: boolean }>>(
      `/checkouts/${data.checkoutId}/payment`,
      data
    );
    return res.data.data;
  },

  async getPartnerCheckouts() {
    const res = await api.get<ApiResponse<Array<CheckoutData["checkout"] & { booking: any }>>>("/checkouts/partner/list");
    return res.data.data;
  }
};
