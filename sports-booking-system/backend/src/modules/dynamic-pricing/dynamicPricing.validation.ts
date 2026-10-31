import { z } from "zod";
import { PRICING_RULE_TYPES } from "./dynamicPricing.rules.js";

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
// IDs in this app are custom prefixed varchar (e.g. "c0001"), not real UUIDs.
const id = z.string().trim().min(1).max(40);

export const dynamicPriceQuerySchema = z.object({
  params: z.object({ courtId: id }),
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: timeSchema,
    endTime: timeSchema
  })
});

export const pricingRuleParamsSchema = z.object({
  params: z.object({ id })
});

// Null clears an optional field on update (a rule back to every day, all day, or without a limit).
const pricingRuleFields = {
  courtId: id,
  name: z.string().trim().min(2, "Tên quy tắc ít nhất 2 ký tự").max(160),
  description: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? null : value), z.string().trim().max(1000).nullable().optional()),
  ruleType: z.enum(PRICING_RULE_TYPES),
  dayType: z.enum(["WEEKDAY", "WEEKEND", "HOLIDAY"]).nullable().optional(),
  startTime: timeSchema.nullable().optional(),
  endTime: timeSchema.nullable().optional(),
  priceAdjustmentType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  // Negative lowers the price; the sign each rule type allows and the limits are checked with the whole rule (pricingRuleProblem).
  priceAdjustmentValue: z.number().finite(),
  minPrice: z.number().nonnegative().nullable().optional(),
  maxPrice: z.number().nonnegative().nullable().optional(),
  priority: z.number().int(),
  status: z.enum(["ACTIVE", "INACTIVE"])
};

export const pricingRuleWriteSchema = z.object({
  body: z.object({
    ...pricingRuleFields,
    priority: pricingRuleFields.priority.default(100),
    status: pricingRuleFields.status.default("ACTIVE")
  })
});

export const pricingRuleUpdateSchema = z.object({
  params: z.object({ id }),
  body: z.object(pricingRuleFields).partial()
});
