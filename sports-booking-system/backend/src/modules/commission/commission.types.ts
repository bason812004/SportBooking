import type { Prisma } from "@prisma/client";

export const DEFAULT_COMMISSION_KEY = "DEFAULT_COMMISSION_RATE";
export const BOOKING_DEPOSIT_KEY = "BOOKING_DEPOSIT_RATE";

export type DbClient = Prisma.TransactionClient;

export type CommissionSummary = {
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  transactionCount: number;
};
