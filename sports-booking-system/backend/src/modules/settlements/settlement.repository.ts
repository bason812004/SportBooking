import { prisma } from "../../config/db.js";

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

export const settlementRepository = {
  findById(id: string) {
    return prisma.settlement.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            bookingCode: true,
            bookingDate: true,
            court: { select: { name: true } }
          }
        }
      }
    });
  },

  findByBookingId(bookingId: string) {
    return prisma.settlement.findUnique({ where: { bookingId } });
  },

  async listByPartner(partnerId: string, page: number, limit: number) {
    const [items, total] = await prisma.$transaction([
      prisma.settlement.findMany({
        where: { partnerId },
        include: {
          booking: {
            select: {
              bookingCode: true,
              bookingDate: true,
              court: { select: { name: true } }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.settlement.count({ where: { partnerId } })
    ]);
    return { items, total };
  },

  async listAll(filters: {
    page: number;
    limit: number;
    partnerId?: string;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.partnerId) where.partnerId = filters.partnerId;
    if (filters.status) where.status = filters.status;
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) (where.createdAt as Record<string, Date>).gte = filters.fromDate;
      if (filters.toDate) (where.createdAt as Record<string, Date>).lte = filters.toDate;
    }

    const [items, total] = await prisma.$transaction([
      prisma.settlement.findMany({
        where,
        include: {
          booking: {
            select: {
              bookingCode: true,
              bookingDate: true,
              court: {
                select: {
                  name: true,
                  partner: { select: { id: true, businessName: true } }
                }
              }
            }
          },
          partner: { select: { id: true, businessName: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit
      }),
      prisma.settlement.count({ where })
    ]);
    return { items, total };
  },

  async summary(filters: { partnerId?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.partnerId) where.partnerId = filters.partnerId;
    if (filters.status) where.status = filters.status;
    const [rows, pendingRows] = await Promise.all([
      prisma.settlement.aggregate({
        where,
        _sum: {
          grossAmount: true,
          platformDiscount: true,
          partnerDiscount: true,
          commissionAmount: true,
          netAmount: true
        },
        _count: true
      }),
      prisma.settlement.aggregate({
        where: { ...where, status: "PENDING" },
        _sum: { netAmount: true },
        _count: true
      })
    ]);
    return {
      grossAmount: toNum(rows._sum.grossAmount),
      platformDiscount: toNum(rows._sum.platformDiscount),
      partnerDiscount: toNum(rows._sum.partnerDiscount),
      commissionAmount: toNum(rows._sum.commissionAmount),
      netAmount: toNum(rows._sum.netAmount),
      totalCount: rows._count,
      pendingCount: pendingRows._count,
      pendingAmount: toNum(pendingRows._sum.netAmount)
    };
  }
};
