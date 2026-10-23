import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export type DbClient = Prisma.TransactionClient | typeof prisma;

export type WalletDto = {
  id: string;
  partnerId: string;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  /** Commission owed on money the partner collected itself that the wallet could not cover. */
  commissionDebt: number;
  currency: string;
  updatedAt: Date;
};
