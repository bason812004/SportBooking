export interface CreateCheckoutInput {
  bookingId: string;
  notes?: string;
}

export interface ProcessCheckoutPaymentInput {
  checkoutId: string;
  amount: number;
  paymentMethod: "CASH" | "QR_TRANSFER" | "BANK_TRANSFER" | "E_WALLET";
  transactionId?: string;
}
