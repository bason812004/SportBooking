import { prisma } from "../../config/db.js";
import type { DbClient, WithdrawalStatus } from "./withdrawal.types.js";

const listInclude = {
  partner: {
    select: {
      id: true,
      businessName: true,
      user: { select: { id: true, fullName: true, email: true } }
    }
  },
  processor: { select: { id: true, fullName: true } }
} as const;

export const withdrawalRepository = {
  create(
    data: {
      partnerId: string;
      amount: number;
      bankName: string | null;
      bankAccountNumber: string | null;
      bankAccountName: string | null;
    },
    db: DbClient
  ) {
    return db.withdrawalRequest.create({ data, include: listInclude });
  },

  byId(id: string, db: DbClient = prisma) {
    return db.withdrawalRequest.findUnique({ where: { id }, include: listInclude });
  },

  async transition(
    id: string,
    fromStatuses: WithdrawalStatus[],
    data: { status: WithdrawalStatus; processedBy?: string; processedAt?: Date; note?: string | null },
    db: DbClient
  ) {
    const result = await db.withdrawalRequest.updateMany({
      where: { id, status: { in: fromStatuses } },
      data
    });
    return result.count;
  },

  async list(filters: { partnerId?: string; status?: WithdrawalStatus }, page: number, limit: number) {
    const where = { partnerId: filters.partnerId, status: filters.status };
    const [items, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.withdrawalRequest.count({ where })
    ]);
    return { items, total };
  },

  summary(partnerId?: string) {
    return prisma.withdrawalRequest.groupBy({
      by: ["status"],
      where: { partnerId },
      _sum: { amount: true },
      _count: { _all: true }
    });
  }
};
