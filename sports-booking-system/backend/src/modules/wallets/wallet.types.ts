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
  currency: string;
  updatedAt: Date;
};
