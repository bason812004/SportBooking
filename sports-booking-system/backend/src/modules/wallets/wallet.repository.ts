import { prisma } from "../../config/db.js";

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

export const walletRepository = {
  async findByPartner(partnerId: string) {
    return prisma.partnerWallet.findUnique({ where: { partnerId } });
  },

  async findOrCreate(partnerId: string) {
    const existing = await prisma.partnerWallet.findUnique({ where: { partnerId } });
    if (existing) return existing;
    return prisma.partnerWallet.create({
      data: { partnerId, availableBalance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0, currency: "VND" }
    });
  },

  async listAll(page: number, limit: number) {
    const [items, total] = await prisma.$transaction([
      prisma.partnerWallet.findMany({
        include: { partner: { select: { id: true, businessName: true, user: { select: { fullName: true } } } } },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.partnerWallet.count()
    ]);
    return { items, total };
  },

  async summary() {
    const rows = await prisma.partnerWallet.aggregate({
      _sum: { availableBalance: true, pendingBalance: true, totalEarned: true, totalWithdrawn: true }
    });
    return {
      totalAvailable: toNum(rows._sum.availableBalance),
      totalPending: toNum(rows._sum.pendingBalance),
      totalEarned: toNum(rows._sum.totalEarned),
      totalWithdrawn: toNum(rows._sum.totalWithdrawn)
    };
  }
};
