import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import type { DbClient, WithdrawalStatus } from "./withdrawal.types.js";

function withdrawalOrderBy(sortBy?: string, sortOrder?: string): Prisma.WithdrawalRequestOrderByWithRelationInput {
  const direction = sortOrder === "asc" ? "asc" : "desc";
  switch (sortBy) {
    case "amount":
      return { amount: direction };
    case "status":
      return { status: direction };
    case "partnerName":
      return { partner: { businessName: direction } };
    default:
      return { createdAt: direction };
  }
}

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
    data: {
      status: WithdrawalStatus;
      processedBy?: string;
      processedAt?: Date;
      note?: string | null;
      providerName?: string;
      providerTransactionId?: string;
      providerResponse?: Prisma.InputJsonValue;
    },
    db: DbClient
  ) {
    const result = await db.withdrawalRequest.updateMany({
      where: { id, status: { in: fromStatuses } },
      data
    });
    return result.count;
  },

  async list(
    filters: {
      partnerId?: string;
      status?: WithdrawalStatus;
      sortBy?: string;
      sortOrder?: string;
      fromDate?: string;
      toDate?: string;
    },
    page: number,
    limit: number
  ) {
    const where: Prisma.WithdrawalRequestWhereInput = {
      partnerId: filters.partnerId,
      status: filters.status,
      createdAt:
        filters.fromDate || filters.toDate
          ? {
              gte: filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`) : undefined,
              lte: filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`) : undefined
            }
          : undefined
    };
    const [items, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where,
        include: listInclude,
        orderBy: withdrawalOrderBy(filters.sortBy, filters.sortOrder),
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
