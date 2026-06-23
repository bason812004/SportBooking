import { z } from "zod";
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
export const dynamicPriceQuerySchema = z.object({
    params: z.object({ courtId: z.string().uuid() }),
    query: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: timeSchema,
        endTime: timeSchema
    })
});
export const pricingRuleParamsSchema = z.object({
    params: z.object({ id: z.string().uuid() })
});
const pricingRuleBodySchema = z.object({
    courtId: z.string().uuid(),
    name: z.string().min(2).max(160),
    description: z.string().optional(),
    ruleType: z.enum(["PEAK_HOUR", "OFF_PEAK_HOUR", "WEEKEND", "HOLIDAY", "HIGH_DEMAND", "LOW_DEMAND", "CUSTOM"]),
    dayType: z.enum(["WEEKDAY", "WEEKEND", "HOLIDAY"]).optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    priceAdjustmentType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    priceAdjustmentValue: z.number().nonnegative(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
    priority: z.number().int().default(100),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
});
export const pricingRuleWriteSchema = z.object({
    body: pricingRuleBodySchema
});
export const pricingRuleUpdateSchema = z.object({
    body: pricingRuleBodySchema.partial()
});
