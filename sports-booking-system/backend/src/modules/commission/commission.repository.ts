import { prisma } from "../../config/db.js";
import type { DbClient } from "./commission.types.js";

export const commissionRepository = {
  setting(key: string, db: DbClient | typeof prisma = prisma) {
    return db.systemSetting.findUnique({ where: { key } });
  },

  upsertSetting(key: string, numericValue: number, description: string, db: DbClient | typeof prisma = prisma) {
    return db.systemSetting.upsert({
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

  /**
   * Every partner with its own rate (null: the default), the day it joined and the last audit entry that changed its
   * rate. A save of the same value is no change: previousRate and rate are compared.
   */
  partnerRateRows() {
    return prisma.$queryRaw<
      Array<{ id: string; businessName: string; commissionRate: unknown; joinedAt: Date; partnerChangeAt: Date | null; partnerChangeBy: string | null }>
    >`
      select p.id, p.business_name as "businessName", p.commission_rate as "commissionRate", p.created_at as "joinedAt",
        pc.created_at as "partnerChangeAt", pc.actor_name as "partnerChangeBy"
      from partner_profiles p
      left join lateral (
        select a.created_at, u.full_name as actor_name
        from audit_logs a
        left join users u on u.id = a.actor_id
        where a.action = 'PARTNER_COMMISSION_UPDATED' and a.entity_id = p.id
          and (a.metadata -> 'previousRate') is distinct from (a.metadata -> 'rate')
        order by a.created_at desc
        limit 1
      ) pc on true
      order by p.business_name
    `;
  },

  /** The last audit entry that changed the default rate, if any. */
  async latestDefaultChange() {
    const rows = await prisma.$queryRaw<Array<{ at: Date; changedBy: string | null }>>`
      select a.created_at as "at", u.full_name as "changedBy"
      from audit_logs a
      left join users u on u.id = a.actor_id
      where a.action = 'COMMISSION_DEFAULT_UPDATED'
        and (a.metadata -> 'previousRate') is distinct from (a.metadata -> 'rate')
      order by a.created_at desc
      limit 1
    `;
    return rows[0] ?? null;
  },

  /** The latest changes to the default and partner rates, from the audit log. */
  rateHistory(limit = 20) {
    return prisma.$queryRaw<Array<{ id: string; action: string; entityId: string; metadata: any; createdAt: Date; actorName: string | null; businessName: string | null }>>`
      select a.id, a.action, a.entity_id as "entityId", a.metadata, a.created_at as "createdAt",
        u.full_name as "actorName", p.business_name as "businessName"
      from audit_logs a
      left join users u on u.id = a.actor_id
      left join partner_profiles p on p.id = a.entity_id and a.action = 'PARTNER_COMMISSION_UPDATED'
      where a.action in ('COMMISSION_DEFAULT_UPDATED', 'PARTNER_COMMISSION_UPDATED')
      order by a.created_at desc
      limit ${limit}
    `;
  },

  setPartnerRate(id: string, commissionRate: number | null, db: DbClient | typeof prisma = prisma) {
    return db.partnerProfile.update({
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

  /** What the booking's earning adds up to so far: the earning itself plus every adjustment raising it. */
  async recordedEarningGross(bookingId: string, db: DbClient) {
    const rows = await db.commissionTransaction.findMany({
      where: { bookingId, transactionType: { in: ["EARNING", "ADJUSTMENT"] } },
      select: { grossAmount: true }
    });
    return rows.reduce((sum, row) => sum + Number(row.grossAmount), 0);
  },

  /**
   * The ledger is immutable (database trigger), so an earning that grows is raised by a new ADJUSTMENT row pointing
   * at it (database/28_booking_auto_finish.sql), never by updating it.
   */
  createAdjustment(
    data: {
      bookingId: string;
      partnerId: string;
      eventType: "COMPLETED" | "NO_SHOW";
      grossAmount: number;
      commissionRate: number;
      commissionAmount: number;
      netAmount: number;
      originalTransactionId: string;
    },
    db: DbClient
  ) {
    return db.commissionTransaction.create({ data: { ...data, transactionType: "ADJUSTMENT" } });
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
  }
};
