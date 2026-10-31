import type { Prisma } from "@prisma/client";
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

type SettlementFilters = {
  partnerId?: string;
  status?: SettlementStatus;
  collectedBy?: "PLATFORM" | "PARTNER";
  search?: string;
  fromDate?: Date;
  toDate?: Date;
};

function settlementWhere(filters: SettlementFilters): Prisma.SettlementWhereInput {
  const contains = filters.search ? { contains: filters.search, mode: "insensitive" as const } : undefined;
  return {
    partnerId: filters.partnerId,
    status: filters.status,
    collectedBy: filters.collectedBy,
    createdAt: filters.fromDate || filters.toDate ? { gte: filters.fromDate, lt: filters.toDate } : undefined,
    OR: contains ? [{ booking: { bookingCode: contains } }, { partner: { businessName: contains } }] : undefined
  };
}

export const settlementRepository = {
  partnerUserId(partnerId: string) {
    return prisma.partnerProfile.findUnique({ where: { id: partnerId }, select: { userId: true } }).then((partner) => partner?.userId ?? null);
  },

  create(
    data: {
      collectedBy?: "PLATFORM" | "PARTNER";
      status?: string;
      settledAt?: Date;
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

  byBookingId(bookingId: string, db: DbClient = prisma, collectedBy = "PLATFORM") {
    return db.settlement.findUnique({ where: { bookingId_collectedBy: { bookingId, collectedBy } } });
  },

  bookingForCollection(bookingId: string, db: DbClient) {
    return db.booking.findUnique({
      where: { id: bookingId },
      include: {
        court: { include: { partner: true } },
        bookingVoucher: { select: { platformShare: true, releasedAt: true } }
      }
    });
  },

  byId(id: string, db: DbClient = prisma) {
    return db.settlement.findUnique({ where: { id }, include: listInclude });
  },

  async incrementAmounts(
    id: string,
    fromStatuses: SettlementStatus[],
    amounts: { grossAmount: number; commissionAmount: number; netAmount: number; platformDiscount?: number },
    db: DbClient
  ) {
    const result = await db.settlement.updateMany({
      where: { id, status: { in: fromStatuses } },
      data: {
        grossAmount: { increment: amounts.grossAmount },
        commissionAmount: { increment: amounts.commissionAmount },
        netAmount: { increment: amounts.netAmount },
        ...(amounts.platformDiscount ? { platformDiscount: { increment: amounts.platformDiscount } } : {})
      }
    });
    return result.count;
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

  async list(filters: SettlementFilters, page: number, limit: number) {
    const where = settlementWhere(filters);
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

  /** A partner's settlements for bookings played between two dates (inclusive), cancelled or failed ones left out. */
  forPlayDates(partnerId: string, from: Date, to: Date) {
    return prisma.settlement.findMany({
      where: { partnerId, status: { notIn: ["CANCELLED", "FAILED"] }, booking: { bookingDate: { gte: from, lte: to } } },
      include: listInclude,
      orderBy: [{ booking: { bookingDate: "desc" } }, { createdAt: "desc" }]
    });
  },

  /** Totals by status for the same filters as the list (the status filter aside, which the totals split by). */
  async summary(filters: SettlementFilters) {
    return prisma.settlement.groupBy({
      by: ["status"],
      where: settlementWhere({ ...filters, status: undefined }),
      _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
      _count: { _all: true }
    });
  }
};
