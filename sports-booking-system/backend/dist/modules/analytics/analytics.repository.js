import { prisma } from "../../config/db.js";
export const analyticsRepository = {
    async trackEvent(data) {
        const rows = await prisma.$queryRaw `
      select 'ae' || lpad(nextval('seq_analytics_events')::text, 4, '0') as id
    `;
        return prisma.analyticsEvent.create({ data: { id: rows[0].id, ...data } });
    },
    partnerOverview(partnerId) {
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
    partnerRevenue(partnerId) {
        return prisma.booking.groupBy({
            by: ["bookingStatus"],
            where: { court: { partnerId } },
            _sum: { totalPrice: true },
            _count: true
        });
    },
    partnerPeakHours(partnerId) {
        return prisma.$queryRaw `
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
