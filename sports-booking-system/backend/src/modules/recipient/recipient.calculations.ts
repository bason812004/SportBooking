/** A court's partner-set rules for time played outside the booked hours (early check-in, extension). */
export type TimeChargePolicy = {
  /** Minutes right before the booked start that are not charged. */
  earlyFreeMinutes: number;
  /** How early play may start; null = no limit, 0 = early check-in not allowed. */
  earlyMaxMinutes: number | null;
  /** % of the hour-by-hour court price charged for early minutes beyond the free ones. */
  earlyPricePercent: number;
  /** % of the hour-by-hour court price charged when play is extended. */
  extensionPricePercent: number;
};

export function toTimeChargePolicy(court: {
  earlyFreeMinutes: number;
  earlyMaxMinutes: number | null;
  earlyPricePercent: unknown;
  extensionPricePercent: unknown;
}): TimeChargePolicy {
  return {
    earlyFreeMinutes: court.earlyFreeMinutes,
    earlyMaxMinutes: court.earlyMaxMinutes,
    earlyPricePercent: Number(court.earlyPricePercent),
    extensionPricePercent: Number(court.extensionPricePercent)
  };
}

/** The partner's % of an hour-by-hour court price; base and dynamic parts are scaled so they still add up. */
export function scaleCourtPrice(price: { basePrice: number; courtSubtotal: number }, percent: number) {
  const amount = Math.round((price.courtSubtotal * percent) / 100);
  const basePrice = Math.round((price.basePrice * percent) / 100);
  return { amount, basePrice, dynamicAdjustmentAmount: amount - basePrice };
}

/**
 * Splits an early arrival into free and charged minutes. The free minutes are the ones just before the
 * booked start, so the charged ones run from now; arriving earlier than the partner's maximum is refused.
 */
export function earlyCheckInWindow(policy: TimeChargePolicy, nowMinutes: number, startMinutes: number) {
  const earlyMinutes = Math.max(0, startMinutes - nowMinutes);
  const freeMinutes = Math.min(earlyMinutes, policy.earlyFreeMinutes);
  return {
    earlyMinutes,
    freeMinutes,
    chargedMinutes: earlyMinutes - freeMinutes,
    maxMinutes: policy.earlyMaxMinutes,
    allowed: policy.earlyMaxMinutes == null || earlyMinutes <= policy.earlyMaxMinutes
  };
}
