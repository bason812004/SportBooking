import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export type DbClient = Prisma.TransactionClient | typeof prisma;

export const WITHDRAWAL_STATUSES = ["PENDING", "APPROVED", "PROCESSING", "REJECTED", "FAILED", "PAID", "CANCELLED"] as const;

/** The smallest withdrawal (VND); amounts are whole dong. */
export const MIN_WITHDRAWAL_AMOUNT = 50_000;

/**
 * No withdrawal for this long after the bank account in the profile was set or changed: the real owner gets the
 * notice and the email first. Admins see a request as "tài khoản mới đổi" for RECENT_BANK_CHANGE_MS after a change.
 */
export const BANK_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const RECENT_BANK_CHANGE_MS = 7 * 24 * 60 * 60 * 1000;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const WITHDRAWAL_SORT_FIELDS = ["createdAt", "amount", "status", "partnerName"] as const;
export type WithdrawalSortField = (typeof WITHDRAWAL_SORT_FIELDS)[number];

/** Money only goes to the bank account saved in the partner profile (changing that needs the password). */
export type CreateWithdrawalInput = {
  amount: number;
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
