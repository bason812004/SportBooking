export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export type WithdrawalRequestInfo = {
  id: string;
  partnerId: string;
  amount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  status: WithdrawalStatus;
  processedBy: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};
