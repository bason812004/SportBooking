import { prisma } from "../../config/db.js";
import type { DbClient, SettlementStatus } from "./settlement.types.js";

const listInclude = {
  booking: {
    select: {
      id: true,
      bookingCode: true,
      bookingDate: true,
      bookingStatus: true,
      court: { select: { id: true, name: true } }
    }
  },
  partner: { select: { id: true, businessName: true } }
} as const;

export const settlementRepository = {
  create(
    data: {
      bookingId: string;
      partnerId: string;
      paymentId: string | null;
      grossAmount: number;
      voucherDiscount: number;
      platformDiscount: number;
      partnerDiscount: number;
      commissionRate: number;
      commissionAmount: number;
      serviceFee: number;
      netAmount: number;
    },
    db: DbClient
  ) {
    return db.settlement.create({ data });
  },

  byBookingId(bookingId: string, db: DbClient = prisma) {
    return db.settlement.findUnique({ where: { bookingId } });
  },

  byId(id: string, db: DbClient = prisma) {
    return db.settlement.findUnique({ where: { id }, include: listInclude });
  },

  async transitionById(
    id: string,
    fromStatuses: SettlementStatus[],
    data: { status: SettlementStatus; settledAt?: Date | null },
    db: DbClient
  ) {
    const result = await db.settlement.updateMany({
      where: { id, status: { in: fromStatuses } },
      data
    });
    return result.count;
  },

  async list(
    filters: {
      partnerId?: string;
      status?: SettlementStatus;
      fromDate?: Date;
      toDate?: Date;
    },
    page: number,
    limit: number
  ) {
    const where = {
      partnerId: filters.partnerId,
      status: filters.status,
      createdAt:
        filters.fromDate || filters.toDate
          ? { gte: filters.fromDate, lt: filters.toDate }
          : undefined
    };
    const [items, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.settlement.count({ where })
    ]);
    return { items, total };
  },

  async summary(filters: { partnerId?: string; fromDate?: Date; toDate?: Date }) {
    return prisma.settlement.groupBy({
      by: ["status"],
      where: {
        partnerId: filters.partnerId,
        createdAt:
          filters.fromDate || filters.toDate
            ? { gte: filters.fromDate, lt: filters.toDate }
            : undefined
      },
      _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
      _count: { _all: true }
    });
  }
};
