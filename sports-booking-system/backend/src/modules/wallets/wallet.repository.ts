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

  // Commission debt: what the platform is owed on money the partner collected itself. Each statement below
  // reads and writes the row once (every SET expression sees the old values), so concurrent charges and
  // settlements cannot interleave between a read and a write.

  /** Takes the commission from the available balance; whatever it cannot cover becomes debt. */
  async chargeCommission(partnerId: string, amount: number, db: DbClient) {
    if (amount <= 0) return;
    await db.partnerWallet.upsert({ where: { partnerId }, create: { partnerId }, update: {} });
    await db.$executeRaw`
      update partner_wallets set
        available_balance = available_balance - least(available_balance, ${amount}::numeric),
        total_earned = total_earned - least(available_balance, ${amount}::numeric),
        commission_debt = commission_debt + ${amount}::numeric - least(available_balance, ${amount}::numeric),
        updated_at = now()
      where partner_id = ${partnerId}`;
  },

  /** Pays debt from the available balance; called whenever money becomes available. */
  offsetDebt(partnerId: string, db: DbClient) {
    return db.$executeRaw`
      update partner_wallets set
        available_balance = available_balance - least(available_balance, commission_debt),
        total_earned = total_earned - least(available_balance, commission_debt),
        commission_debt = commission_debt - least(available_balance, commission_debt),
        updated_at = now()
      where partner_id = ${partnerId} and commission_debt > 0 and available_balance > 0`;
  },

  /** Reverses a commission charge: clears debt first, then returns the rest to the available balance. */
  refundCommission(partnerId: string, amount: number, db: DbClient) {
    return db.$executeRaw`
      update partner_wallets set
        commission_debt = commission_debt - least(commission_debt, ${amount}::numeric),
        available_balance = available_balance + ${amount}::numeric - least(commission_debt, ${amount}::numeric),
        total_earned = total_earned + ${amount}::numeric - least(commission_debt, ${amount}::numeric),
        updated_at = now()
      where partner_id = ${partnerId}`;
  },

  /** Debt paid by a transfer to the platform account (recorded by an admin). */
  async payDebt(partnerId: string, amount: number, db: DbClient) {
    const result = await db.partnerWallet.updateMany({
      where: { partnerId, commissionDebt: { gte: amount } },
      data: { commissionDebt: { decrement: amount } }
    });
    return result.count;
  },

  recordDebtPayment(data: { partnerId: string; amount: number; note?: string | null; recordedBy: string }, db: DbClient) {
    return db.partnerCommissionDebtPayment.create({ data: { ...data, note: data.note || null } });
  },

  debtPayments(partnerId: string, take = 20) {
    return prisma.partnerCommissionDebtPayment.findMany({ where: { partnerId }, orderBy: { createdAt: "desc" }, take });
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

  async adminList(params: { page: number; limit: number; search?: string; hasDebt?: boolean }) {
    const where = {
      ...(params.search
        ? {
            partner: {
              OR: [
                { businessName: { contains: params.search, mode: "insensitive" as const } },
                { user: { email: { contains: params.search, mode: "insensitive" as const } } }
              ]
            }
          }
        : {}),
      ...(params.hasDebt ? { commissionDebt: { gt: 0 } } : {})
    };
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
        orderBy: params.hasDebt ? { commissionDebt: "desc" } : { updatedAt: "desc" },
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
    const [aggregate, count, debtorCount] = await Promise.all([
      prisma.partnerWallet.aggregate({
        _sum: {
          availableBalance: true,
          pendingBalance: true,
          totalEarned: true,
          totalWithdrawn: true,
          commissionDebt: true
        }
      }),
      prisma.partnerWallet.count(),
      prisma.partnerWallet.count({ where: { commissionDebt: { gt: 0 } } })
    ]);
    return { aggregate, count, debtorCount };
  }
};
