import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export const analyticsRepository = {
  trackEvent(data: {
    userId?: string | null;
    partnerId?: string | null;
    eventType:
      | "COURT_VIEWED"
      | "COURT_SEARCHED"
      | "BOOKING_CREATED"
      | "BOOKING_CANCELLED"
      | "VOUCHER_CLAIMED"
      | "VOUCHER_APPLIED"
      | "TOURNAMENT_VIEWED"
      | "TOURNAMENT_REGISTERED"
      | "DYNAMIC_PRICE_VIEWED"
      | "DYNAMIC_PRICE_CALCULATED"
      | "PREDICTION_VIEWED"
      | "DEMAND_PREDICTION_GENERATED"
      | "TOURNAMENT_CREATED";
    entityType: string;
    entityId?: string | null;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    return prisma.analyticsEvent.create({ data });
  },

  partnerOverview(partnerId: string) {
    return prisma.$transaction([
      prisma.booking.count({ where: { court: { partnerId } } }),
      prisma.booking.aggregate({ where: { court: { partnerId }, paymentStatus: "PAID" }, _sum: { totalPrice: true } }),
      prisma.booking.count({ where: { court: { partnerId }, bookingStatus: "CANCELLED" } }),
      prisma.voucher.count({ where: { partnerId } }),
      prisma.tournament.count({ where: { partnerId } })
    ]);
  },

  adminOverview() {
    return prisma.$transaction([
      prisma.user.count(),
      prisma.partnerProfile.count(),
      prisma.court.count(),
      prisma.booking.count(),
      prisma.booking.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalPrice: true } }),
      prisma.voucher.count(),
      prisma.tournament.count()
    ]);
  },

  partnerRevenue(partnerId: string) {
    return prisma.booking.groupBy({
      by: ["bookingStatus"],
      where: { court: { partnerId } },
      _sum: { totalPrice: true },
      _count: true
    });
  },

  partnerPeakHours(partnerId: string) {
    return prisma.$queryRaw<Array<{ hour: number; bookingCount: bigint }>>`
      select extract(hour from b.start_time)::int as hour, count(*)::bigint as "bookingCount"
      from bookings b
      join courts c on c.id = b.court_id
      where c.partner_id = ${partnerId}::uuid
        and b.booking_status not in ('CANCELLED'::booking_status, 'NO_SHOW'::booking_status)
      group by extract(hour from b.start_time)
      order by "bookingCount" desc, hour asc
    `;
  },

  adminPredictionStatus() {
    return prisma.demandPrediction.groupBy({
      by: ["status"],
      _count: true
    });
  }
};
