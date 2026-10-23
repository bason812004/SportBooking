import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { earlyCheckInWindow, scaleCourtPrice, type TimeChargePolicy } from "./recipient.calculations.js";
import { timeChargePolicySchema } from "../partner/partner.validation.js";

const policy = (overrides: Partial<TimeChargePolicy> = {}): TimeChargePolicy => ({
  earlyFreeMinutes: 0,
  earlyMaxMinutes: null,
  earlyPricePercent: 100,
  extensionPricePercent: 100,
  ...overrides
});
const at = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

describe("early check-in window", () => {
  it("defaults charge every early minute with no limit, as before", () => {
    assert.deepEqual(earlyCheckInWindow(policy(), at("17:20"), at("18:00")), {
      earlyMinutes: 40, freeMinutes: 0, chargedMinutes: 40, maxMinutes: null, allowed: true
    });
  });

  it("free minutes are taken off the charge; arriving within them costs nothing", () => {
    assert.equal(earlyCheckInWindow(policy({ earlyFreeMinutes: 10 }), at("17:35"), at("18:00")).chargedMinutes, 15);
    assert.equal(earlyCheckInWindow(policy({ earlyFreeMinutes: 10 }), at("17:52"), at("18:00")).chargedMinutes, 0);
  });

  it("arriving earlier than the partner's maximum is refused; 0 means no early check-in", () => {
    assert.equal(earlyCheckInWindow(policy({ earlyMaxMinutes: 30 }), at("17:30"), at("18:00")).allowed, true);
    assert.equal(earlyCheckInWindow(policy({ earlyMaxMinutes: 30 }), at("17:29"), at("18:00")).allowed, false);
    assert.equal(earlyCheckInWindow(policy({ earlyMaxMinutes: 0 }), at("17:59"), at("18:00")).allowed, false);
  });
});

describe("percent of the court price", () => {
  it("scales the charge and keeps base + dynamic part equal to it", () => {
    const scaled = scaleCourtPrice({ basePrice: 250000, courtSubtotal: 300000 }, 120);
    assert.deepEqual(scaled, { amount: 360000, basePrice: 300000, dynamicAdjustmentAmount: 60000 });
    const odd = scaleCourtPrice({ basePrice: 33333, courtSubtotal: 33333 }, 50);
    assert.equal(odd.basePrice + odd.dynamicAdjustmentAmount, odd.amount);
    assert.equal(scaleCourtPrice({ basePrice: 200000, courtSubtotal: 200000 }, 0).amount, 0);
  });
});

describe("partner time-charge policy input", () => {
  const parse = (body: Record<string, unknown>) =>
    timeChargePolicySchema.safeParse({ body: { earlyFreeMinutes: 10, earlyMaxMinutes: 30, earlyPricePercent: 100, extensionPricePercent: 120, ...body } });

  it("accepts a normal policy and 'no limit' (null) for the early maximum", () => {
    assert.equal(parse({}).success, true);
    assert.equal(parse({ earlyMaxMinutes: null, earlyFreeMinutes: 60 }).success, true);
  });

  it("rejects more free minutes than the early maximum, negatives and absurd percents", () => {
    assert.equal(parse({ earlyFreeMinutes: 40 }).success, false);
    assert.equal(parse({ earlyFreeMinutes: -1 }).success, false);
    assert.equal(parse({ extensionPricePercent: 501 }).success, false);
  });
});
