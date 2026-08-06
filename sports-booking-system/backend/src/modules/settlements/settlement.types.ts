import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export type DbClient = Prisma.TransactionClient | typeof prisma;

export const SETTLEMENT_STATUSES = ["PENDING", "PROCESSING", "SETTLED", "FAILED", "CANCELLED"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export type SettlementListQuery = {
  page?: string;
  limit?: string;
  status?: SettlementStatus;
  partnerId?: string;
  fromDate?: string;
  toDate?: string;
};
