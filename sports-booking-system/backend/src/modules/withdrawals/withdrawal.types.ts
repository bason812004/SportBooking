import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export type DbClient = Prisma.TransactionClient | typeof prisma;

export const WITHDRAWAL_STATUSES = ["PENDING", "APPROVED", "PROCESSING", "REJECTED", "FAILED", "PAID"] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const WITHDRAWAL_SORT_FIELDS = ["createdAt", "amount", "status", "partnerName"] as const;
export type WithdrawalSortField = (typeof WITHDRAWAL_SORT_FIELDS)[number];

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
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  fromDate?: string;
  toDate?: string;
};
