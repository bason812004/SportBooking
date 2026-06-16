import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { timeToDate, toDbDate } from "../../shared/utils/time.js";

export const dynamicPricingRepository = {
  courtWithBasePrices(courtId: string) {
    return prisma.court.findFirst({
      where: { id: courtId, approvalStatus: "APPROVED", activeStatus: "ACTIVE" },
      include: { prices: true, basePrices: true }
    });
  },

  activeRules(courtId: string) {
    return prisma.dynamicPricingRule.findMany({
      where: { courtId, status: "ACTIVE" },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
    });
  },

  partnerProfile(userId: string) {
    return prisma.partnerProfile.findUnique({ where: { userId } });
  },

  partnerCourt(courtId: string, partnerId: string) {
    return prisma.court.findFirst({ where: { id: courtId, partnerId } });
  },

  listPartnerRules(partnerId: string) {
    return prisma.dynamicPricingRule.findMany({
      where: { partnerId },
      include: { court: { select: { id: true, name: true } } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
    });
  },

  findPartnerRule(id: string, partnerId: string) {
    return prisma.dynamicPricingRule.findFirst({ where: { id, partnerId }, include: { court: true } });
  },

  createRule(data: Prisma.DynamicPricingRuleUncheckedCreateInput) {
    return prisma.dynamicPricingRule.create({ data });
  },

  updateRule(id: string, data: Prisma.DynamicPricingRuleUpdateInput) {
    return prisma.dynamicPricingRule.update({ where: { id }, data });
  },

  deleteRule(id: string) {
    return prisma.dynamicPricingRule.delete({ where: { id } });
  },

  countBookingsForSlot(courtId: string, date: string, startTime: string, endTime: string) {
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
