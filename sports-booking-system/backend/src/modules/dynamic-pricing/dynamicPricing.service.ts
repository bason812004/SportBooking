import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { calculateDynamicPrice } from "../../shared/utils/businessRules.js";
import { priceBands, priceDayTypes, priceOrThrow, minutesClock, type HolidayDay } from "../../shared/utils/courtPricing.js";
import { timeToDate, timeToMinutes } from "../../shared/utils/time.js";
import { logger } from "../../shared/utils/logger.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { holidayRepository } from "../holidays/holiday.repository.js";
import { invalidateWeeklyScheduleCache } from "../weekly-schedule/weeklySchedule.service.js";
import { dynamicPricingRepository } from "./dynamicPricing.repository.js";
import { pricingRuleProblem } from "./dynamicPricing.rules.js";

function dbTime(value: Date | null) {
  return value ? value.toISOString().slice(11, 16) : null;
}

/** Undefined leaves a field as it is, null clears it ("HH:MM" times become the stored time-of-day). */
function timeField(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value === null ? null : timeToDate(value);
}

function assertRuleShape(rule: Parameters<typeof pricingRuleProblem>[0]) {
  const problem = pricingRuleProblem(rule);
  if (problem) throw new ValidationError(problem);
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

type PricingPrefetch = {
  court: NonNullable<Awaited<ReturnType<typeof dynamicPricingRepository.courtWithBasePrices>>>;
  rules: Awaited<ReturnType<typeof dynamicPricingRepository.activeRules>>;
  holidays: HolidayDay[];
};

export const dynamicPricingService = {
  /** Fetches the court's base prices + active rules once — reuse across many `resolveFromPrefetched`
   * calls (e.g. one per week of a recurring booking) instead of re-querying per call. */
  async prefetch(courtId: string): Promise<PricingPrefetch> {
    const court = await dynamicPricingRepository.courtWithBasePrices(courtId);
    if (!court) throw new NotFoundError("San khong ton tai hoac chua duoc duyet");
    const [rules, holidays] = await Promise.all([dynamicPricingRepository.activeRules(courtId), holidayRepository.all()]);
    return { court, rules, holidays };
  },

  /**
   * Pure price resolution from already-fetched court/rules — no DB I/O, no analytics event. The window is priced
   * piece by piece (see coverWithPrices) and the dynamic rules apply to each piece; the result is per hour, averaged
   * over the window, so callers multiply it by the window's hours as before. Part of the window without a price
   * refuses the whole booking.
   */
  resolveFromPrefetched(prefetched: PricingPrefetch, input: { date: string; startTime: string; endTime: string }) {
    if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) throw new ValidationError("Gio bat dau phai nho hon gio ket thuc");
    const { court, rules, holidays } = prefetched;
    const startMins = timeToMinutes(input.startTime);
    const endMins = timeToMinutes(input.endTime);
    const bands = priceBands([
      ...court.basePrices.map((row) => ({ ...row, price: row.basePrice })),
      ...court.prices
    ]);
    const pieces = priceOrThrow(bands, input.date, startMins, endMins, holidays);
    const dayTypes = priceDayTypes(input.date, holidays);

    let base = 0;
    let final = 0;
    const adjustments: ReturnType<typeof calculateDynamicPrice>["adjustments"] = [];
    for (const piece of pieces) {
      const hours = (piece.end - piece.start) / 60;
      const pieceStart = minutesClock(piece.start);
      const pieceEnd = minutesClock(piece.end);
      let finalPrice = piece.price;
      try {
        const result = calculateDynamicPrice({
          basePrice: piece.price,
          rules: rules
            .filter((rule) => (!rule.dayType || dayTypes.includes(rule.dayType)) && overlapsWindow(rule.startTime, rule.endTime, pieceStart, pieceEnd))
            .map((rule) => ({
              ruleName: rule.name,
              type: rule.priceAdjustmentType,
              value: Number(rule.priceAdjustmentValue),
              minPrice: rule.minPrice == null ? null : Number(rule.minPrice),
              maxPrice: rule.maxPrice == null ? null : Number(rule.maxPrice)
            }))
        });
        finalPrice = result.finalPrice;
        for (const adjustment of result.adjustments) {
          const same = adjustments.find((item) => item.ruleName === adjustment.ruleName);
          if (same) same.amount += adjustment.amount * hours;
          else adjustments.push({ ...adjustment, amount: adjustment.amount * hours });
        }
      } catch (error) {
        logger.warn("dynamic_price_fallback_base_price", { courtId: court.id, error: error instanceof Error ? error.message : String(error) });
      }
      base += piece.price * hours;
      final += finalPrice * hours;
    }

    const hours = (endMins - startMins) / 60;
    return {
      courtId: court.id,
      basePrice: base / hours,
      adjustments: adjustments.map((item) => ({ ...item, amount: item.amount / hours })),
      dynamicAdjustmentAmount: (final - base) / hours,
      finalPrice: final / hours,
      currency: "VND"
    };
  },

  async calculate(courtId: string, input: { date: string; startTime: string; endTime: string }) {
    const prefetched = await this.prefetch(courtId);
    const result = this.resolveFromPrefetched(prefetched, input);

    await trackEvent({
      partnerId: prefetched.court.partnerId,
      eventType: "DYNAMIC_PRICE_CALCULATED",
      entityType: "COURT",
      entityId: courtId,
      metadataJson: { date: input.date, startTime: input.startTime, endTime: input.endTime, finalPrice: result.finalPrice }
    });

    return result;
  },

  async listRules(userId: string) {
    const profile = await partnerProfile(userId);
    return dynamicPricingRepository.listPartnerRules(profile.id);
  },

  /**
   * Bulk pricing resolution for one court across a whole week. Fetches the
   * court, its base price table, and all active rules exactly once, then
   * computes the per-slot price entirely in memory. Replaces the previous
   * N+1 implementation that called `calculate()` for every slot (which
   * hammered the Supabase pooler and triggered P2024 timeouts).
   */
  async calculateForWeek(input: {
    courtId: string;
    weekStart: string;
    weekEnd: string;
    openMinutes: number;
    closeMinutes: number;
  }) {
    const court = await dynamicPricingRepository.courtWithBasePrices(input.courtId);
    if (!court) throw new NotFoundError("San khong ton tai hoac chua duoc duyet");

    const [activeRules, holidays] = await Promise.all([dynamicPricingRepository.activeRules(input.courtId), holidayRepository.all()]);
    const basePriceRows = court.basePrices ?? [];
    const fallbackPriceRows = court.prices ?? [];

    return {
      courtId: input.courtId,
      partnerId: court.partnerId,
      fallbackBasePrice:
        fallbackPriceRows.length > 0
          ? Math.min(...fallbackPriceRows.map((row) => Number(row.price)))
          : 0,
      rules: activeRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        ruleType: rule.ruleType,
        dayType: rule.dayType,
        startTime: rule.startTime ? dbTime(rule.startTime) : null,
        endTime: rule.endTime ? dbTime(rule.endTime) : null,
        priceAdjustmentType: rule.priceAdjustmentType,
        priceAdjustmentValue: Number(rule.priceAdjustmentValue),
        minPrice: rule.minPrice == null ? null : Number(rule.minPrice),
        maxPrice: rule.maxPrice == null ? null : Number(rule.maxPrice),
        priority: rule.priority,
        status: rule.status
      })),
      basePrices: basePriceRows.map((row) => ({
        dayType: row.dayType,
        startTime: dbTime(row.startTime)!,
        endTime: dbTime(row.endTime)!,
        basePrice: Number(row.basePrice),
        createdAt: row.createdAt
      })),
      legacyPrices: fallbackPriceRows.map((row) => ({
        dayType: row.dayType,
        startTime: dbTime(row.startTime)!,
        endTime: dbTime(row.endTime)!,
        price: Number(row.price),
        createdAt: row.createdAt
      })),
      holidays
    };
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
    assertRuleShape(input);
    const rule = await dynamicPricingRepository.createRule({
      partnerId: profile.id,
      courtId: input.courtId,
      name: input.name,
      description: input.description ?? null,
      ruleType: input.ruleType,
      dayType: input.dayType ?? null,
      startTime: timeField(input.startTime) ?? null,
      endTime: timeField(input.endTime) ?? null,
      priceAdjustmentType: input.priceAdjustmentType,
      priceAdjustmentValue: input.priceAdjustmentValue,
      minPrice: input.minPrice ?? null,
      maxPrice: input.maxPrice ?? null,
      priority: input.priority,
      status: input.status
    });
    invalidateWeeklyScheduleCache(rule.courtId);
    return rule;
  },

  async updateRule(userId: string, id: string, input: any) {
    const profile = await partnerProfile(userId);
    const existing = await dynamicPricingRepository.findPartnerRule(id, profile.id);
    if (!existing) throw new NotFoundError("Khong tim thay quy tac gia");
    if (input.courtId && !(await dynamicPricingRepository.partnerCourt(input.courtId, profile.id))) {
      throw new ForbiddenError("Chi duoc cap nhat quy tac cho san cua ban");
    }
    // The rule as it will be saved, checked as a whole (an update may send only the field that changes).
    const pick = <T>(field: string, saved: T) => (input[field] === undefined ? saved : input[field]);
    assertRuleShape({
      ruleType: pick("ruleType", existing.ruleType),
      startTime: pick("startTime", dbTime(existing.startTime)),
      endTime: pick("endTime", dbTime(existing.endTime)),
      priceAdjustmentType: pick("priceAdjustmentType", existing.priceAdjustmentType),
      priceAdjustmentValue: Number(pick("priceAdjustmentValue", existing.priceAdjustmentValue)),
      minPrice: pick("minPrice", existing.minPrice == null ? null : Number(existing.minPrice)),
      maxPrice: pick("maxPrice", existing.maxPrice == null ? null : Number(existing.maxPrice))
    });
    const rule = await dynamicPricingRepository.updateRule(id, {
      ...input,
      startTime: timeField(input.startTime),
      endTime: timeField(input.endTime)
    });
    invalidateWeeklyScheduleCache(existing.courtId);
    if (rule.courtId !== existing.courtId) invalidateWeeklyScheduleCache(rule.courtId);
    return rule;
  },

  async deleteRule(userId: string, id: string) {
    const rule = await this.getRule(userId, id);
    const deleted = await dynamicPricingRepository.deleteRule(id);
    invalidateWeeklyScheduleCache(rule.courtId);
    return deleted;
  },

  async setStatus(userId: string, id: string, status: "ACTIVE" | "INACTIVE") {
    const rule = await this.getRule(userId, id);
    const updated = await dynamicPricingRepository.updateRule(id, { status });
    invalidateWeeklyScheduleCache(rule.courtId);
    return updated;
  }
};
