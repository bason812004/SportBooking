import { prisma } from "../../config/db.js";
import type { DbClient } from "./wallet.types.js";

export const walletRepository = {
  ensure(partnerId: string, db: DbClient = prisma) {
    return db.partnerWallet.upsert({
      where: { partnerId },
      create: { partnerId },
      update: {}
    });
  },

  byPartnerId(partnerId: string, db: DbClient = prisma) {
    return db.partnerWallet.findUnique({ where: { partnerId } });
  },

  creditPending(partnerId: string, amount: number, db: DbClient) {
    return db.partnerWallet.upsert({
      where: { partnerId },
      create: { partnerId, pendingBalance: amount, totalEarned: amount },
      update: {
        pendingBalance: { increment: amount },
        totalEarned: { increment: amount }
      }
    });
  },

  async settlePending(partnerId: string, amount: number, db: DbClient) {
    const result = await db.partnerWallet.updateMany({
      where: { partnerId, pendingBalance: { gte: amount } },
      data: {
        pendingBalance: { decrement: amount },
        availableBalance: { increment: amount }
      }
    });
    return result.count;
  },

  async rollbackPending(partnerId: string, amount: number, db: DbClient) {
    const result = await db.partnerWallet.updateMany({
      where: { partnerId, pendingBalance: { gte: amount } },
      data: {
        pendingBalance: { decrement: amount },
        totalEarned: { decrement: amount }
      }
    });
    return result.count;
  },

  async holdAvailable(partnerId: string, amount: number, db: DbClient) {
    const result = await db.partnerWallet.updateMany({
      where: { partnerId, availableBalance: { gte: amount } },
      data: { availableBalance: { decrement: amount } }
    });
    return result.count;
  },

  releaseHold(partnerId: string, amount: number, db: DbClient) {
    return db.partnerWallet.update({
      where: { partnerId },
      data: { availableBalance: { increment: amount } }
    });
  },

  markWithdrawn(partnerId: string, amount: number, db: DbClient) {
    return db.partnerWallet.update({
      where: { partnerId },
      data: { totalWithdrawn: { increment: amount } }
    });
  },

  async debitAvailable(partnerId: string, amount: number, db: DbClient) {
    const result = await db.partnerWallet.updateMany({
      where: { partnerId, availableBalance: { gte: amount } },
      data: {
        availableBalance: { decrement: amount },
        totalEarned: { decrement: amount }
      }
    });
    return result.count;
  },

  async adminList(params: { page: number; limit: number; search?: string }) {
    const where = params.search
      ? {
          partner: {
            OR: [
              { businessName: { contains: params.search, mode: "insensitive" as const } },
              { user: { email: { contains: params.search, mode: "insensitive" as const } } }
            ]
          }
        }
      : {};
    const [items, total] = await Promise.all([
      prisma.partnerWallet.findMany({
        where,
        include: {
          partner: {
            select: {
              id: true,
              businessName: true,
              bankName: true,
              bankAccountNumber: true,
              bankAccountHolder: true,
              user: { select: { id: true, fullName: true, email: true } }
            }
          }
        },
        orderBy: { updatedAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit
      }),
      prisma.partnerWallet.count({ where })
    ]);
    return { items, total };
  },

  adminDetail(partnerId: string) {
    return prisma.partnerWallet.findUnique({
      where: { partnerId },
      include: {
        partner: {
          select: {
            id: true,
            businessName: true,
            bankName: true,
            bankAccountNumber: true,
            bankAccountHolder: true,
            user: { select: { id: true, fullName: true, email: true } }
          }
        }
      }
    });
  },

  async adminSummary() {
    const [aggregate, count] = await Promise.all([
      prisma.partnerWallet.aggregate({
        _sum: {
          availableBalance: true,
          pendingBalance: true,
          totalEarned: true,
          totalWithdrawn: true
        }
      }),
      prisma.partnerWallet.count()
    ]);
    return { aggregate, count };
  }
};
