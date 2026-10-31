import { timeToMinutes } from "../../shared/utils/time.js";

export const PRICING_RULE_TYPES = ["PEAK_HOUR", "OFF_PEAK_HOUR", "WEEKEND", "HOLIDAY", "HIGH_DEMAND", "LOW_DEMAND", "CUSTOM"] as const;
export type PricingRuleType = (typeof PRICING_RULE_TYPES)[number];

/** Rule types that only raise the price, and those that only lower it; CUSTOM may do either. */
const SURCHARGE_TYPES: readonly string[] = ["PEAK_HOUR", "WEEKEND", "HOLIDAY", "HIGH_DEMAND"];
const DISCOUNT_TYPES: readonly string[] = ["OFF_PEAK_HOUR", "LOW_DEMAND"];

export const MAX_PERCENT_DISCOUNT = 90;
export const MAX_PERCENT_SURCHARGE = 300;
export const MAX_FIXED_ADJUSTMENT = 10_000_000;

export type PricingRuleShape = {
  ruleType: string;
  startTime?: string | null;
  endTime?: string | null;
  priceAdjustmentType: string;
  priceAdjustmentValue: number;
  minPrice?: number | null;
  maxPrice?: number | null;
};

/** What is wrong with a rule as a whole (create, or an update merged onto the saved rule), or null when it is fine. */
export function pricingRuleProblem(rule: PricingRuleShape): string | null {
  const value = rule.priceAdjustmentValue;
  if (!Number.isFinite(value) || value === 0) return "Mức điều chỉnh phải khác 0";
  if (SURCHARGE_TYPES.includes(rule.ruleType) && value < 0) return "Loại quy tắc này chỉ tăng giá: nhập mức điều chỉnh dương";
  if (DISCOUNT_TYPES.includes(rule.ruleType) && value > 0) return "Giờ thấp điểm / nhu cầu thấp là giảm giá: nhập mức điều chỉnh âm";
  if (rule.priceAdjustmentType === "PERCENTAGE") {
    if (value < -MAX_PERCENT_DISCOUNT) return `Giảm tối đa ${MAX_PERCENT_DISCOUNT}%`;
    if (value > MAX_PERCENT_SURCHARGE) return `Tăng tối đa ${MAX_PERCENT_SURCHARGE}%`;
  } else if (Math.abs(value) > MAX_FIXED_ADJUSTMENT) {
    return "Mức điều chỉnh cố định tối đa 10.000.000đ";
  }

  const hasStart = Boolean(rule.startTime);
  const hasEnd = Boolean(rule.endTime);
  if (hasStart !== hasEnd) return "Nhập đủ giờ bắt đầu và giờ kết thúc, hoặc để trống cả hai (áp dụng cả ngày)";
  if (hasStart && timeToMinutes(rule.startTime!) >= timeToMinutes(rule.endTime!)) return "Giờ bắt đầu phải trước giờ kết thúc";

  if (rule.minPrice != null && rule.maxPrice != null && rule.minPrice > rule.maxPrice) return "Giá tối thiểu không được lớn hơn giá tối đa";
  return null;
}
