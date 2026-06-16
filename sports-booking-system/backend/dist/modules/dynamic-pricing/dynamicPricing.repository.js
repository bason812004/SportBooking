import { prisma } from "../../config/db.js";
import { timeToDate, toDbDate } from "../../shared/utils/time.js";
export const dynamicPricingRepository = {
    courtWithBasePrices(courtId) {
        return prisma.court.findFirst({
            where: { id: courtId, approvalStatus: "APPROVED", activeStatus: "ACTIVE" },
            include: { prices: true, basePrices: true }
        });
    },
    activeRules(courtId) {
        return prisma.dynamicPricingRule.findMany({
            where: { courtId, status: "ACTIVE" },
            orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
        });
    },
    partnerProfile(userId) {
        return prisma.partnerProfile.findUnique({ where: { userId } });
    },
    partnerCourt(courtId, partnerId) {
        return prisma.court.findFirst({ where: { id: courtId, partnerId } });
    },
    listPartnerRules(partnerId) {
        return prisma.dynamicPricingRule.findMany({
            where: { partnerId },
            include: { court: { select: { id: true, name: true } } },
            orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
        });
    },
    findPartnerRule(id, partnerId) {
        return prisma.dynamicPricingRule.findFirst({ where: { id, partnerId }, include: { court: true } });
    },
    createRule(data) {
        return prisma.dynamicPricingRule.create({ data });
    },
    updateRule(id, data) {
        return prisma.dynamicPricingRule.update({ where: { id }, data });
    },
    deleteRule(id) {
        return prisma.dynamicPricingRule.delete({ where: { id } });
    },
    countBookingsForSlot(courtId, date, startTime, endTime) {
        return prisma.booking.count({
            where: {
                courtId,
                bookingDate: toDbDate(date),
                bookingStatus: { notIn: ["CANCELLED", "NO_SHOW"] },
                startTime: { lt: timeToDate(endTime) },
                endTime: { gt: timeToDate(startTime) }
            }
        });
    }
};
