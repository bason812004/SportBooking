export type CreateQrPaymentInput = {
  amount: number;
  currency: "VND";
  orderId: string;
  paymentReference: string;
  description: string;
  expiresAt: Date;
};

export type CreateQrPaymentResult = {
  provider: string;
  externalOrderId: string;
  qrCodeUrl: string | null;
  qrPayload: string | null;
  providerConfigured: boolean;
};

export type VerifiedPaymentWebhook = {
  provider: string;
  externalOrderId: string;
  externalTransactionId: string;
  status: "PAID" | "FAILED" | "EXPIRED";
  amount: number;
  rawPayload: unknown;
};

export type PaymentStatusResult = {
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";
};

export interface PaymentProvider {
  createQrPayment(input: CreateQrPaymentInput): Promise<CreateQrPaymentResult>;
  verifyWebhook(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<VerifiedPaymentWebhook>;
  getPaymentStatus(externalTransactionId: string): Promise<PaymentStatusResult>;
}

