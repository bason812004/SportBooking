import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { calculateDynamicPrice } from "../../shared/utils/businessRules.js";
import { dayTypeFor, timeToDate, timeToMinutes } from "../../shared/utils/time.js";
import { logger } from "../../shared/utils/logger.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { dynamicPricingRepository } from "./dynamicPricing.repository.js";
function dbTime(value) {
    return value ? value.toISOString().slice(11, 16) : null;
}
function overlapsWindow(ruleStart, ruleEnd, startTime, endTime) {
    if (!ruleStart || !ruleEnd)
        return true;
    return timeToMinutes(dbTime(ruleStart)) <= timeToMinutes(startTime) && timeToMinutes(dbTime(ruleEnd)) >= timeToMinutes(endTime);
}
async function partnerProfile(userId) {
    const profile = await dynamicPricingRepository.partnerProfile(userId);
    if (!profile)
        throw new ForbiddenError("Tai khoan doi tac chua co ho so");
    return profile;
}
export const dynamicPricingService = {
    /** Fetches the court's base prices + active rules once — reuse across many `resolveFromPrefetched`
     * calls (e.g. one per week of a recurring booking) instead of re-querying per call. */
    async prefetch(courtId) {
        const court = await dynamicPricingRepository.courtWithBasePrices(courtId);
        if (!court)
            throw new NotFoundError("San khong ton tai hoac chua duoc duyet");
        const rules = await dynamicPricingRepository.activeRules(courtId);
        return { court, rules };
    },
    /** Pure price resolution from already-fetched court/rules — no DB I/O, no analytics event. */
    resolveFromPrefetched(prefetched, input) {
        if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime))
            throw new ValidationError("Gio bat dau phai nho hon gio ket thuc");
        const { court, rules } = prefetched;
        const dayType = dayTypeFor(input.date);
        const startMins = timeToMinutes(input.startTime);
        const endMins = timeToMinutes(input.endTime);
        const allPriceRows = [
            ...court.basePrices.map((p) => ({
                dayType: p.dayType,
                startTimeMins: timeToMinutes(dbTime(p.startTime)),
                endTimeMins: timeToMinutes(dbTime(p.endTime)),
                price: Number(p.basePrice)
            })),
            ...court.prices.map((p) => ({
                dayType: p.dayType,
                startTimeMins: timeToMinutes(dbTime(p.startTime)),
                endTimeMins: timeToMinutes(dbTime(p.endTime)),
                price: Number(p.price)
            }))
        ];
        // Priority 1: Exact match for same dayType
        let basePriceMatch = allPriceRows.find((p) => p.dayType === dayType && p.startTimeMins <= startMins && p.endTimeMins >= endMins);
        // Priority 2: Overlapping match for same dayType
        if (!basePriceMatch) {
            basePriceMatch = allPriceRows.find((p) => p.dayType === dayType && p.startTimeMins < endMins && p.endTimeMins > startMins);
        }
        // Priority 3: Any match for same dayType
        if (!basePriceMatch) {
            basePriceMatch = allPriceRows.find((p) => p.dayType === dayType);
        }
        // Priority 4: Fallback to any price entry for this court
        if (!basePriceMatch && allPriceRows.length > 0) {
            basePriceMatch = allPriceRows[0];
        }
        if (!basePriceMatch)
            throw new ValidationError("Khung giờ này chưa có bảng giá. Vui lòng thiết lập bảng giá cho sân.");
        const basePrice = basePriceMatch.price;
        try {
            const applicableRules = rules.filter((rule) => (!rule.dayType || rule.dayType === dayType) &&
                overlapsWindow(rule.startTime, rule.endTime, input.startTime, input.endTime));
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
            return { courtId: court.id, ...result, currency: "VND" };
        }
        catch (error) {
            logger.warn("dynamic_price_fallback_base_price", { courtId: court.id, error: error instanceof Error ? error.message : String(error) });
            return { courtId: court.id, basePrice, adjustments: [], dynamicAdjustmentAmount: 0, finalPrice: basePrice, currency: "VND" };
        }
    },
    async calculate(courtId, input) {
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
    async listRules(userId) {
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
    async calculateForWeek(input) {
        const court = await dynamicPricingRepository.courtWithBasePrices(input.courtId);
        if (!court)
            throw new NotFoundError("San khong ton tai hoac chua duoc duyet");
        const [activeRules, basePriceRows, fallbackPriceRows] = await Promise.all([
            dynamicPricingRepository.activeRules(input.courtId),
            Promise.resolve(court.basePrices ?? []),
            Promise.resolve(court.prices ?? [])
        ]);
        return {
            courtId: input.courtId,
            partnerId: court.partnerId,
            fallbackBasePrice: fallbackPriceRows.length > 0
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
                startTime: dbTime(row.startTime),
                endTime: dbTime(row.endTime),
                basePrice: Number(row.basePrice)
            })),
            legacyPrices: fallbackPriceRows.map((row) => ({
                dayType: row.dayType,
                startTime: dbTime(row.startTime),
                endTime: dbTime(row.endTime),
                price: Number(row.price)
            }))
        };
    },
    async getRule(userId, id) {
        const profile = await partnerProfile(userId);
        const rule = await dynamicPricingRepository.findPartnerRule(id, profile.id);
        if (!rule)
            throw new NotFoundError("Khong tim thay quy tac gia");
        return rule;
    },
    async createRule(userId, input) {
        const profile = await partnerProfile(userId);
        const court = await dynamicPricingRepository.partnerCourt(input.courtId, profile.id);
        if (!court)
            throw new ForbiddenError("Chi duoc tao quy tac cho san cua ban");
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
    async updateRule(userId, id, input) {
        const profile = await partnerProfile(userId);
        const existing = await dynamicPricingRepository.findPartnerRule(id, profile.id);
        if (!existing)
            throw new NotFoundError("Khong tim thay quy tac gia");
        if (input.courtId && !(await dynamicPricingRepository.partnerCourt(input.courtId, profile.id))) {
            throw new ForbiddenError("Chi duoc cap nhat quy tac cho san cua ban");
        }
        return dynamicPricingRepository.updateRule(id, {
            ...input,
            startTime: input.startTime ? timeToDate(input.startTime) : undefined,
            endTime: input.endTime ? timeToDate(input.endTime) : undefined
        });
    },
    async deleteRule(userId, id) {
        await this.getRule(userId, id);
        return dynamicPricingRepository.deleteRule(id);
    },
    async setStatus(userId, id, status) {
        await this.getRule(userId, id);
        return dynamicPricingRepository.updateRule(id, { status });
    }
};
