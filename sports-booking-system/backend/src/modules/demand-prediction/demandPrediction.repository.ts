
import { prisma } from "../../config/db.js";
import { timeToDate, toDbDate } from "../../shared/utils/time.js";

export const demandPredictionRepository = {
  court(courtId: string) {
    return prisma.court.findFirst({ where: { id: courtId, approvalStatus: "APPROVED", activeStatus: "ACTIVE" }, include: { category: true } });
  },

  partnerProfile(userId: string) {
    return prisma.partnerProfile.findUnique({ where: { userId } });
  },

  partnerCourt(courtId: string, partnerId: string) {
    return prisma.court.findFirst({ where: { id: courtId, partnerId } });
  },

  totalHistoricalBookings(courtId: string) {
    return prisma.booking.count({ where: { courtId, bookingStatus: { notIn: ["CANCELLED", "NO_SHOW"] } } });
  },

  matchingSlotBookings(courtId: string, startTime: string, endTime: string) {
    return prisma.booking.count({
      where: {
        courtId,
        bookingStatus: { notIn: ["CANCELLED", "NO_SHOW"] },
        startTime: { lt: timeToDate(endTime) },
        endTime: { gt: timeToDate(startTime) }
      }
    });
  },

  cancellationCount(courtId: string) {
    return prisma.booking.count({ where: { courtId, bookingStatus: "CANCELLED" } });
  },

  averageComparableSlotBookings(courtId: string) {
    return prisma.$queryRaw<Array<{ average: number }>>`
      select coalesce(avg(slot_count), 0)::float as average
      from (
        select booking_date, start_time, count(*) as slot_count
        from bookings
        where court_id = ${courtId}
          and booking_status not in ('CANCELLED'::booking_status, 'NO_SHOW'::booking_status)
        group by booking_date, start_time
      ) grouped_slots
    `;
  },

  savePrediction(data: {
    courtId: string;
    predictionDate: string;
    startTime: string;
    endTime: string;
    predictedDemandScore: number | null;
    predictedOccupancyRate: number | null;
    confidenceScore: number;
    predictionLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | null;
    status: "GENERATED" | "INSUFFICIENT_DATA" | "FAILED";
    modelVersion: string;
  }) {
    return prisma.demandPrediction.create({
      data: {
        courtId: data.courtId,
        predictionDate: toDbDate(data.predictionDate),
        startTime: timeToDate(data.startTime),
        endTime: timeToDate(data.endTime),
        predictedDemandScore: data.predictedDemandScore,
        predictedOccupancyRate: data.predictedOccupancyRate,
        confidenceScore: data.confidenceScore,
        predictionLevel: data.predictionLevel,
        status: data.status,
        modelVersion: data.modelVersion
      }
    });
  },

  slotPriceAndVoucherStats(courtId: string, startTime: string, endTime: string) {
    return prisma.$queryRaw<Array<{ averagePrice: number; voucherUsageCount: bigint }>>`
      select
        coalesce(avg(b.total_price), 0)::float as "averagePrice",
        count(bv.id)::bigint as "voucherUsageCount"
      from bookings b
      left join booking_vouchers bv on bv.booking_id = b.id
      where b.court_id = ${courtId}
        and b.booking_status not in ('CANCELLED'::booking_status, 'NO_SHOW'::booking_status)
        and b.start_time < ${timeToDate(endTime)}::time
        and b.end_time > ${timeToDate(startTime)}::time
    `;
  },

  partnerPeakHours(partnerId: string) {
    return prisma.$queryRaw<Array<{ courtId: string; courtName: string; hour: number; bookingCount: bigint }>>`
      select c.id as "courtId", c.name as "courtName", extract(hour from b.start_time)::int as hour, count(*)::bigint as "bookingCount"
      from bookings b
      join courts c on c.id = b.court_id
      where c.partner_id = ${partnerId}
        and b.booking_status not in ('CANCELLED'::booking_status, 'NO_SHOW'::booking_status)
      group by c.id, c.name, extract(hour from b.start_time)
      order by "bookingCount" desc
      limit 20
    `;
  }
};
