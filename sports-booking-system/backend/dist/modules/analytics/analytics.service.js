import { ForbiddenError } from "../../shared/errors/AppError.js";
import { calculateOccupancyRate } from "../../shared/utils/businessRules.js";
import { logger } from "../../shared/utils/logger.js";
import { analyticsRepository } from "./analytics.repository.js";
import { prisma } from "../../config/db.js";
export async function partnerIdForUser(userId) {
    const profile = await prisma.partnerProfile.findUnique({ where: { userId } });
    if (!profile)
        throw new ForbiddenError("Tai khoan doi tac chua co ho so");
    return profile.id;
}
export async function trackEvent(input) {
    try {
        return await analyticsRepository.trackEvent(input);
    }
    catch (error) {
        logger.warn("analytics_event_failed", { eventType: input.eventType, error: error instanceof Error ? error.message : String(error) });
        return null;
    }
}
export const analyticsService = {
    async partnerOverview(userId) {
        const partnerId = await partnerIdForUser(userId);
        const [totalBookings, revenue, cancelledBookings, vouchers, tournaments] = await analyticsRepository.partnerOverview(partnerId);
        const cancellationRate = totalBookings ? cancelledBookings / totalBookings : 0;
        return {
            totalRevenue: Number(revenue._sum.totalPrice ?? 0),
            totalBookings,
            cancellationRate,
            averageBookingValue: totalBookings ? Number(revenue._sum.totalPrice ?? 0) / totalBookings : 0,
            voucherCount: vouchers,
            tournamentCount: tournaments
        };
    },
    async partnerRevenue(userId) {
        const partnerId = await partnerIdForUser(userId);
        return analyticsRepository.partnerRevenue(partnerId);
    },
    async partnerPeakHours(userId) {
        const partnerId = await partnerIdForUser(userId);
        const rows = await analyticsRepository.partnerPeakHours(partnerId);
        return rows.map((row) => ({ hour: row.hour, bookingCount: Number(row.bookingCount) }));
    },
    async partnerOccupancy(userId) {
        const overview = await this.partnerOverview(userId);
        return { occupancyRate: calculateOccupancyRate({ bookedSlots: overview.totalBookings, totalSlots: Math.max(overview.totalBookings, 1) }) };
    },
    async partnerVouchers(userId) {
        const partnerId = await partnerIdForUser(userId);
        const [claimed, used, total] = await prisma.$transaction([
            prisma.userVoucher.count({ where: { voucher: { partnerId } } }),
            prisma.userVoucher.count({ where: { voucher: { partnerId }, status: "USED" } }),
            prisma.voucher.count({ where: { partnerId } })
        ]);
        return { totalVouchers: total, claimedCount: claimed, usedCount: used, usageRate: claimed ? used / claimed : 0 };
    },
    async partnerTournaments(userId) {
        const partnerId = await partnerIdForUser(userId);
        const [total, registrations] = await prisma.$transaction([
            prisma.tournament.count({ where: { partnerId } }),
            prisma.tournamentRegistration.count({ where: { tournament: { partnerId } } })
        ]);
        return { totalTournaments: total, registrationCount: registrations };
    },
    async adminOverview() {
        const [users, partners, courts, bookings, revenue, vouchers, tournaments] = await analyticsRepository.adminOverview();
        return {
            users,
            partners,
            courts,
            totalBookings: bookings,
            totalRevenue: Number(revenue._sum.totalPrice ?? 0),
            vouchers,
            tournaments
        };
    },
    adminPredictionStatus() {
        return analyticsRepository.adminPredictionStatus();
    }
};
