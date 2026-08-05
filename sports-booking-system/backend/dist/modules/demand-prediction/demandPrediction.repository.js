import { prisma } from "../../config/db.js";
import { timeToDate, toDbDate } from "../../shared/utils/time.js";
export const demandPredictionRepository = {
    court(courtId) {
        return prisma.court.findFirst({ where: { id: courtId, approvalStatus: "APPROVED", activeStatus: "ACTIVE" }, include: { category: true } });
    },
    partnerProfile(userId) {
        return prisma.partnerProfile.findUnique({ where: { userId } });
    },
    partnerCourt(courtId, partnerId) {
        return prisma.court.findFirst({ where: { id: courtId, partnerId } });
    },
    totalHistoricalBookings(courtId) {
        return prisma.booking.count({ where: { courtId, bookingStatus: { notIn: ["CANCELLED", "NO_SHOW"] } } });
    },
    matchingSlotBookings(courtId, startTime, endTime) {
        return prisma.booking.count({
            where: {
                courtId,
                bookingStatus: { notIn: ["CANCELLED", "NO_SHOW"] },
                startTime: { lt: timeToDate(endTime) },
                endTime: { gt: timeToDate(startTime) }
            }
        });
    },
    /**
     * Returns the matching booking count per (start_time, end_time) pair for a
     * court. Used by the bulk weekly-schedule path so we can score every slot
     * without firing one query per slot.
     */
    bookingCountsByStartTime(courtId) {
        return prisma.$queryRaw `
      select to_char(start_time, 'HH24:MI') as "startTime",
             to_char(end_time, 'HH24:MI') as "endTime",
             count(*)::int as count
      from bookings
      where court_id = ${courtId}
        and booking_status not in ('CANCELLED'::booking_status, 'NO_SHOW'::booking_status)
      group by start_time, end_time
    `;
    },
    cancellationCount(courtId) {
        return prisma.booking.count({ where: { courtId, bookingStatus: "CANCELLED" } });
    },
    averageComparableSlotBookings(courtId) {
        return prisma.$queryRaw `
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
    savePrediction(data) {
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
    slotPriceAndVoucherStats(courtId, startTime, endTime) {
        return prisma.$queryRaw `
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
    partnerPeakHours(partnerId) {
        return prisma.$queryRaw `
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
