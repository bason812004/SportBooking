import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { calculateDynamicPrice } from "../../shared/utils/businessRules.js";
import { dayTypeFor, timeToDate, timeToMinutes } from "../../shared/utils/time.js";
import { logger } from "../../shared/utils/logger.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { dynamicPricingRepository } from "./dynamicPricing.repository.js";

function dbTime(value: Date | null) {
  return value ? value.toISOString().slice(11, 16) : null;
}

function overlapsWindow(ruleStart: Date | null, ruleEnd: Date | null, startTime: string, endTime: string) {
  if (!ruleStart || !ruleEnd) return true;
  return timeToMinutes(dbTime(ruleStart)!) <= timeToMinutes(startTime) && timeToMinutes(dbTime(ruleEnd)!) >= timeToMinutes(endTime);
}

async function partnerProfile(userId: string) {
  const profile = await dynamicPricingRepository.partnerProfile(userId);
  if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
  return profile;
}

export const dynamicPricingService = {
  async calculate(courtId: string, input: { date: string; startTime: string; endTime: string }) {
    if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) throw new ValidationError("Gio bat dau phai nho hon gio ket thuc");
    const court = await dynamicPricingRepository.courtWithBasePrices(courtId);
    if (!court) throw new NotFoundError("San khong ton tai hoac chua duoc duyet");

    const dayType = dayTypeFor(input.date);
    const basePriceRow =
      court.basePrices.find(
        (price) =>
          price.dayType === dayType &&
          timeToMinutes(dbTime(price.startTime)!) <= timeToMinutes(input.startTime) &&
          timeToMinutes(dbTime(price.endTime)!) >= timeToMinutes(input.endTime)
      ) ??
      court.prices.find(
        (price) =>
          price.dayType === dayType &&
          timeToMinutes(dbTime(price.startTime)!) <= timeToMinutes(input.startTime) &&
          timeToMinutes(dbTime(price.endTime)!) >= timeToMinutes(input.endTime)
      );

    if (!basePriceRow) throw new ValidationError("Khung gio nay chua co bang gia");
    const basePrice = Number("basePrice" in basePriceRow ? basePriceRow.basePrice : basePriceRow.price);

    try {
      const rules = await dynamicPricingRepository.activeRules(courtId);
      const applicableRules = rules.filter(
        (rule) =>
          (!rule.dayType || rule.dayType === dayType) &&
          overlapsWindow(rule.startTime, rule.endTime, input.startTime, input.endTime)
      );

      const result = calculateDynamicPrice({
        basePrice,
        rules: applicableRules.map((rule) => ({
          ruleName: rule.name,
          type: rule.priceAdjustmentType,
          value: Number(rule.priceAdjustmentValue),
          minPrice: rule.minPrice == null ? null : Number(rule.minPrice),
          maxPrice: rule.maxPrice == null ? null : Number(rule.maxPrice)
        }))
      });

      await trackEvent({
        partnerId: court.partnerId,
        eventType: "DYNAMIC_PRICE_CALCULATED",
        entityType: "COURT",
        entityId: courtId,
        metadataJson: { date: input.date, startTime: input.startTime, endTime: input.endTime, finalPrice: result.finalPrice }
      });

      return { courtId, ...result, currency: "VND" };
    } catch (error) {
      logger.warn("dynamic_price_fallback_base_price", { courtId, error: error instanceof Error ? error.message : String(error) });
      return { courtId, basePrice, adjustments: [], dynamicAdjustmentAmount: 0, finalPrice: basePrice, currency: "VND" };
    }
  },

  async listRules(userId: string) {
    const profile = await partnerProfile(userId);
    return dynamicPricingRepository.listPartnerRules(profile.id);
  },

  async getRule(userId: string, id: string) {
    const profile = await partnerProfile(userId);
    const rule = await dynamicPricingRepository.findPartnerRule(id, profile.id);
    if (!rule) throw new NotFoundError("Khong tim thay quy tac gia");
    return rule;
  },

  async createRule(userId: string, input: any) {
    const profile = await partnerProfile(userId);
    const court = await dynamicPricingRepository.partnerCourt(input.courtId, profile.id);
    if (!court) throw new ForbiddenError("Chi duoc tao quy tac cho san cua ban");
    return dynamicPricingRepository.createRule({
      partnerId: profile.id,
      courtId: input.courtId,
      name: input.name,
      description: input.description,
      ruleType: input.ruleType,
      dayType: input.dayType,
      startTime: input.startTime ? timeToDate(input.startTime) : undefined,
      endTime: input.endTime ? timeToDate(input.endTime) : undefined,
      priceAdjustmentType: input.priceAdjustmentType,
      priceAdjustmentValue: input.priceAdjustmentValue,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      priority: input.priority,
      status: input.status
    });
  },

  async updateRule(userId: string, id: string, input: any) {
    const profile = await partnerProfile(userId);
    const existing = await dynamicPricingRepository.findPartnerRule(id, profile.id);
    if (!existing) throw new NotFoundError("Khong tim thay quy tac gia");
    if (input.courtId && !(await dynamicPricingRepository.partnerCourt(input.courtId, profile.id))) {
      throw new ForbiddenError("Chi duoc cap nhat quy tac cho san cua ban");
    }
    return dynamicPricingRepository.updateRule(id, {
      ...input,
      startTime: input.startTime ? timeToDate(input.startTime) : undefined,
      endTime: input.endTime ? timeToDate(input.endTime) : undefined
    });
  },

  async deleteRule(userId: string, id: string) {
    await this.getRule(userId, id);
    return dynamicPricingRepository.deleteRule(id);
  },

  async setStatus(userId: string, id: string, status: "ACTIVE" | "INACTIVE") {
    await this.getRule(userId, id);
    return dynamicPricingRepository.updateRule(id, { status });
  }
};
