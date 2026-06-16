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
    cancellationCount(courtId) {
        return prisma.booking.count({ where: { courtId, bookingStatus: "CANCELLED" } });
    },
    averageComparableSlotBookings(courtId) {
        return prisma.$queryRaw `
      select coalesce(avg(slot_count), 0)::float as average
      from (
        select booking_date, start_time, count(*) as slot_count
        from bookings
        where court_id = ${courtId}::uuid
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
                status: data.status
            }
        });
    },
    partnerPeakHours(partnerId) {
        return prisma.$queryRaw `
      select c.id as "courtId", c.name as "courtName", extract(hour from b.start_time)::int as hour, count(*)::bigint as "bookingCount"
      from bookings b
      join courts c on c.id = b.court_id
      where c.partner_id = ${partnerId}::uuid
        and b.booking_status not in ('CANCELLED'::booking_status, 'NO_SHOW'::booking_status)
      group by c.id, c.name, extract(hour from b.start_time)
      order by "bookingCount" desc
      limit 20
    `;
    }
};
