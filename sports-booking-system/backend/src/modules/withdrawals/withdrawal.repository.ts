import { prisma } from "../../config/db.js";

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

export const withdrawalRepository = {
  async findById(id: string) {
    return prisma.withdrawalRequest.findUnique({
      where: { id },
      include: {
        partner: { select: { id: true, businessName: true } },
        processor: { select: { id: true, fullName: true } }
      }
    });
  },

  async listByPartner(partnerId: string, page: number, limit: number) {
    const [items, total] = await prisma.$transaction([
      prisma.withdrawalRequest.findMany({
        where: { partnerId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.withdrawalRequest.count({ where: { partnerId } })
    ]);
    return { items, total };
  },

  async listAll(filters: {
    page: number;
    limit: number;
    partnerId?: string;
    status?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.partnerId) where.partnerId = filters.partnerId;
    if (filters.status) where.status = filters.status;

    const [items, total] = await prisma.$transaction([
      prisma.withdrawalRequest.findMany({
        where,
        include: {
          partner: { select: { id: true, businessName: true, user: { select: { fullName: true } } } },
          processor: { select: { id: true, fullName: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit
      }),
      prisma.withdrawalRequest.count({ where })
    ]);
    return { items, total };
  },

  async summary(filters: { partnerId?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.partnerId) where.partnerId = filters.partnerId;
    const [allRows, pendingRows, paidRows] = await Promise.all([
      prisma.withdrawalRequest.aggregate({
        where,
        _sum: { amount: true },
        _count: true
      }),
      prisma.withdrawalRequest.aggregate({
        where: { ...where, status: "PENDING" },
        _sum: { amount: true },
        _count: true
      }),
      prisma.withdrawalRequest.aggregate({
        where: { ...where, status: "PAID" },
        _sum: { amount: true },
        _count: true
      })
    ]);
    return {
      totalCount: allRows._count,
      totalAmount: toNum(allRows._sum.amount),
      pendingCount: pendingRows._count,
      pendingAmount: toNum(pendingRows._sum.amount),
      paidCount: paidRows._count,
      paidAmount: toNum(paidRows._sum.amount)
    };
  }
};
