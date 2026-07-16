export type SettlementStatus = "PENDING" | "PROCESSING" | "SETTLED" | "FAILED" | "CANCELLED";

export type SettlementWithDetails = {
  id: string;
  bookingId: string;
  partnerId: string;
  paymentId: string | null;
  grossAmount: number;
  voucherDiscount: number;
  platformDiscount: number;
  partnerDiscount: number;
  commissionAmount: number;
  serviceFee: number;
  netAmount: number;
  status: SettlementStatus;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
  booking?: {
    bookingCode: string;
    bookingDate: string;
    court: { name: string };
  };
  payment?: {
    amount: number;
    status: string;
  };
};

export type SettlementBreakdown = {
  grossAmount: number;
  voucherDiscount: number;
  platformDiscount: number;
  partnerDiscount: number;
  commissionAmount: number;
  serviceFee: number;
  netAmount: number;
  commissionRate: number;
};
