export type CreatePayoutInput = {
  withdrawalId: string;
  amount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  forceResult?: "SUCCESS" | "FAILED" | "TIMEOUT" | "RANDOM";
};

export type CreatePayoutResult = {
  provider: string;
  externalTransactionId: string;
  status: "PROCESSING";
};

export type VerifiedPayoutWebhook = {
  provider: string;
  externalTransactionId: string;
  withdrawalId: string;
  status: "SUCCESS" | "FAILED";
  rawPayload: unknown;
};

export interface PayoutProvider {
  createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult>;
  verifyWebhook(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<VerifiedPayoutWebhook>;
}
