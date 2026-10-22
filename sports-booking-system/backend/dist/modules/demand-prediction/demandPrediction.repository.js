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
    partnerCourtWithCategory(courtId, partnerId) {
        return prisma.court.findFirst({ where: { id: courtId, partnerId }, include: { category: true } });
    },
    /**
     * Rolling history per (day_of_week, hour) "slot pattern" from weeks strictly before
     * `beforeDate` (a Monday). Mirrors `build_training_frame` in ml/scripts/feature_engineering.py
     * (Monday-based weeks, NO_SHOW counted as cancelled, weeks without bookings count as
     * zero from the pattern's first week on) so served features match training.
     */
    slotPatternStats(courtId, beforeDate) {
        return prisma.$queryRaw `
      with weekly as (
        select extract(isodow from b.booking_date)::int - 1 as dow,
               extract(hour from b.start_time)::int as hour,
               date_trunc('week', b.booking_date) as week,
               count(*) filter (where b.booking_status not in ('CANCELLED'::booking_status, 'NO_SHOW'::booking_status))::int as booking_count,
               count(*) filter (where b.booking_status in ('CANCELLED'::booking_status, 'NO_SHOW'::booking_status))::int as cancellation_count,
               count(bv.id)::int as voucher_count,
               coalesce(avg(b.total_price), 0)::float as avg_price
        from bookings b
        left join booking_vouchers bv on bv.booking_id = b.id
        where b.court_id = ${courtId}
          and b.booking_date < ${beforeDate}::date
        group by 1, 2, 3
      )
      select dow,
             hour,
             sum(booking_count)::float as "priorTotal",
             sum(booking_count)::float / greatest((${beforeDate}::date - min(week)::date) / 7, 1) as "priorAvg",
             sum(cancellation_count)::float as "priorCancel",
             sum(voucher_count)::float as "priorVoucher",
             avg(avg_price)::float as "priorPrice"
      from weekly
      group by dow, hour
    `;
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
    /**
     * Average all-time booking total per (start_time, end_time) window. Must be on the
     * same scale as `matchingSlotBookings` / `bookingCountsByStartTime` (all-time totals
     * for one window); averaging per (date, start_time) instead gave ~1 and saturated
     * every slot at HIGH/VERY_HIGH.
     */
    averageComparableSlotBookings(courtId) {
        return prisma.$queryRaw `
      select coalesce(avg(slot_count), 0)::float as average
      from (
        select start_time, end_time, count(*) as slot_count
        from bookings
        where court_id = ${courtId}
          and booking_status not in ('CANCELLED'::booking_status, 'NO_SHOW'::booking_status)
        group by start_time, end_time
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
