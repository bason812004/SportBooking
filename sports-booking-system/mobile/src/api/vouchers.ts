import { api } from "./client";
import type { ApiResponse, MyVoucher, Voucher } from "./types";

export type VoucherValidatePayload = {
  voucherId?: string;
  code?: string;
  courtId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  services?: Array<{ serviceId: string; quantity: number }>;
};

export type VoucherValidateResult = {
  voucher: Voucher;
  courtSubtotal: number;
  servicesSubtotal: number;
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
  message: string;
};

export const voucherApi = {
  async list() {
    const { data } = await api.get<ApiResponse<Voucher[]>>("/vouchers");
    return data.data;
  },
  async detail(id: string) {
    const { data } = await api.get<ApiResponse<Voucher>>(`/vouchers/${id}`);
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
  async claimAll() {
    const { data } = await api.post<ApiResponse<{
      claimedCount: number;
      skippedCount: number;
      claimedVouchers: Array<{ id: string; code: string; title: string }>;
      skippedVouchers: Array<{ id: string; code: string; reason: string }>;
    }>>("/vouchers/claim-all");
    return data.data;
  },
  async validate(payload: VoucherValidatePayload) {
    const { data } = await api.post<ApiResponse<VoucherValidateResult>>("/vouchers/validate", payload);
    return data.data;
  }
};
