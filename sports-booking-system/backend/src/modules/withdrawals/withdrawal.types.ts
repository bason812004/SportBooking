import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export type DbClient = Prisma.TransactionClient | typeof prisma;

export const WITHDRAWAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "PAID"] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export type CreateWithdrawalInput = {
  amount: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
};

export type WithdrawalListQuery = {
  page?: string;
  limit?: string;
  status?: WithdrawalStatus;
  partnerId?: string;
};
