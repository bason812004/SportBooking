import { prisma } from "../../config/db.js";
import type { DbClient } from "./commission.types.js";

export const commissionRepository = {
  setting(key: string, db: DbClient | typeof prisma = prisma) {
    return db.systemSetting.findUnique({ where: { key } });
  },

  upsertSetting(key: string, numericValue: number, description: string) {
    return prisma.systemSetting.upsert({
      where: { key },
      create: { key, numericValue, description },
      update: { numericValue }
    });
  },

  partner(id: string, db: DbClient | typeof prisma = prisma) {
    return db.partnerProfile.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true } } }
    });
  },

  setPartnerRate(id: string, commissionRate: number | null) {
    return prisma.partnerProfile.update({
      where: { id },
      data: { commissionRate },
      include: { user: { select: { id: true, fullName: true, email: true } } }
    });
  },

  earningByBooking(bookingId: string, db: DbClient | typeof prisma = prisma) {
    return db.commissionTransaction.findFirst({
      where: { bookingId, transactionType: "EARNING" }
    });
  },

  createEarning(
    data: {
      bookingId: string;
      partnerId: string;
      eventType: "COMPLETED" | "NO_SHOW";
      grossAmount: number;
      commissionRate: number;
      commissionAmount: number;
      netAmount: number;
    },
    db: DbClient
  ) {
    return db.commissionTransaction.create({
      data: { ...data, transactionType: "EARNING" }
    });
  },

  async reportAggregate(from: Date, to: Date) {
    const [totals, perPartner] = await Promise.all([
      prisma.commissionTransaction.aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
        _count: true
      }),
      prisma.commissionTransaction.groupBy({
        by: ["partnerId"],
        where: { createdAt: { gte: from, lt: to } },
        _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
        _count: true
      })
    ]);

    const partners = perPartner.length
      ? await prisma.partnerProfile.findMany({
          where: { id: { in: perPartner.map((row) => row.partnerId) } },
          select: { id: true, businessName: true }
        })
      : [];
    const partnerNames = new Map(partners.map((partner) => [partner.id, partner.businessName]));

    return { totals, perPartner, partnerNames };
  },

  partnerReport(partnerId: string, from: Date, to: Date) {
    return prisma.commissionTransaction.findMany({
      where: { partnerId, createdAt: { gte: from, lt: to } },
      include: {
        booking: {
          select: {
            id: true,
            bookingCode: true,
            bookingDate: true,
            court: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }
};
