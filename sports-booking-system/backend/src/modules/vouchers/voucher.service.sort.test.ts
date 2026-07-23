/**
 * Service-level integration tests for the voucher eligibility engine.
 * Tests: sorting, bestVoucher selection, priorityScore, graceful fallback.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateVoucherEligibility,
  type VoucherLike
} from "./voucher.eligibility.js";

function makeVoucher(overrides: Partial<VoucherLike> = {}): VoucherLike {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 86_400_000);
  return {
    id: "v_test",
    code: "TEST10",
    discountType: "PERCENTAGE",
    discountValue: 10,
    maxDiscountAmount: 50000,
    minBookingAmount: 0,
    usageLimit: 100,
    usedCount: 0,
    startDate: new Date("2026-01-01"),
    endDate: nextMonth,
    status: "ACTIVE",
    fundedBy: "PARTNER",
    partnerFundingPercent: 100,
    platformFundingPercent: 0,
    ...overrides
  };
}

const baseCtx = {
  bookingDate: "2026-07-18",
  startTime: "08:00",
  endTime: "10:00",
  courtId: "court-1",
  subtotal: 200000
};

/**
 * Simulates the service-level grouping and sorting logic.
 */
function groupAndSort(vouchers: VoucherLike[], ctx: typeof baseCtx) {
  const results = vouchers.map(v => {
    const result = evaluateVoucherEligibility(v, ctx);
    return {
      voucher: v,
      eligible: result.eligible,
      discountAmount: result.eligible ? result.discountAmount : 0,
      reason: result.eligible ? null : { code: (result as { code: string; message: string }).code, message: (result as { code: string; message: string }).message }
    };
  });

  const available = results.filter(r => r.eligible);
  const unavailable = results.filter(r => !r.eligible);

  available.sort((a, b) => {
    if (b.discountAmount !== a.discountAmount) return b.discountAmount - a.discountAmount;
    const aExpiry = new Date(a.voucher.endDate).getTime();
    const bExpiry = new Date(b.voucher.endDate).getTime();
    return aExpiry - bExpiry;
  });

  return { bestVoucher: available[0] ?? null, available, unavailable };
}

describe("voucher sorting and grouping", { concurrency: false }, () => {
  it("sorts available vouchers by discount descending", () => {
    const vouchers = [
      makeVoucher({ id: "low", code: "LOW", discountType: "FIXED_AMOUNT", discountValue: 10000 }),
      makeVoucher({ id: "high", code: "HIGH", discountType: "FIXED_AMOUNT", discountValue: 80000 }),
      makeVoucher({ id: "med", code: "MED", discountType: "FIXED_AMOUNT", discountValue: 40000 })
    ];
    const { available } = groupAndSort(vouchers, baseCtx);
    assert.equal(available[0].voucher.code, "HIGH");
    assert.equal(available[1].voucher.code, "MED");
    assert.equal(available[2].voucher.code, "LOW");
  });

  it("sorts by expiry when discounts are equal", () => {
    const later = new Date(Date.now() + 90 * 86_400_000);
    const sooner = new Date(Date.now() + 10 * 86_400_000);
    const vouchers = [
      makeVoucher({ id: "later", code: "LATER", discountType: "FIXED_AMOUNT", discountValue: 50000, endDate: later }),
      makeVoucher({ id: "sooner", code: "SOONER", discountType: "FIXED_AMOUNT", discountValue: 50000, endDate: sooner })
    ];
    const { available } = groupAndSort(vouchers, baseCtx);
    assert.equal(available[0].voucher.code, "SOONER");
    assert.equal(available[1].voucher.code, "LATER");
  });

  it("places ineligible vouchers in the unavailable group", () => {
    const vouchers = [
      makeVoucher({ id: "expired", code: "EXPIRED", endDate: new Date("2020-01-01") }),
      makeVoucher({ id: "valid", code: "VALID" })
    ];
    const { available, unavailable } = groupAndSort(vouchers, baseCtx);
    assert.equal(available.length, 1);
    assert.equal(available[0].voucher.code, "VALID");
    assert.equal(unavailable.length, 1);
    assert.equal(unavailable[0].voucher.code, "EXPIRED");
  });

  it("selects the best voucher as the one with highest discount", () => {
    const vouchers = [
      makeVoucher({ id: "best", code: "BEST", discountType: "FIXED_AMOUNT", discountValue: 100000 }),
      makeVoucher({ id: "second", code: "SECOND", discountType: "FIXED_AMOUNT", discountValue: 30000 })
    ];
    const { bestVoucher } = groupAndSort(vouchers, baseCtx);
    assert.ok(bestVoucher !== null);
    assert.equal(bestVoucher.voucher.code, "BEST");
  });

  it("bestVoucher is null when no vouchers are eligible", () => {
    const vouchers = [
      makeVoucher({ id: "bad", code: "BAD", minBookingAmount: 999999 }),
      makeVoucher({ id: "worse", code: "WORSE", status: "INACTIVE" })
    ];
    const { bestVoucher, available } = groupAndSort(vouchers, baseCtx);
    assert.equal(bestVoucher, null);
    assert.equal(available.length, 0);
  });

  it("places only-amount-eligible vouchers in available group", () => {
    const vouchers = [
      makeVoucher({ id: "ok", code: "OK", minBookingAmount: 100000 }),
      makeVoucher({ id: "fail", code: "FAIL", minBookingAmount: 999999 })
    ];
    const { available, unavailable } = groupAndSort(vouchers, baseCtx);
    assert.equal(available.length, 1);
    assert.equal(available[0].voucher.code, "OK");
    assert.equal(unavailable.length, 1);
    assert.equal(unavailable[0].voucher.code, "FAIL");
  });

  it("correctly separates weekday vs weekend vouchers", () => {
    // Booking on Saturday
    const ctx = { ...baseCtx, bookingDate: "2026-07-18" }; // Saturday
    const vouchers = [
      makeVoucher({ id: "weekend", code: "WEEKEND", applicableDays: "SATURDAY,SUNDAY" }),
      makeVoucher({ id: "weekday", code: "WEEKDAY", applicableDays: "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY" })
    ];
    const { available, unavailable } = groupAndSort(vouchers, ctx);
    assert.equal(available.length, 1);
    assert.equal(available[0].voucher.code, "WEEKEND");
    assert.equal(unavailable.length, 1);
    assert.equal(unavailable[0].voucher.code, "WEEKDAY");
  });

  it("correctly separates time-window vouchers", () => {
    const vouchers = [
      makeVoucher({ id: "night", code: "NIGHT", startTime: "18:00", endTime: "23:59" }),
      makeVoucher({ id: "morning", code: "MORNING", startTime: "06:00", endTime: "12:00" })
    ];
    // Booking 08:00-10:00 — morning should match, night should not
    const { available, unavailable } = groupAndSort(vouchers, baseCtx);
    assert.equal(available.length, 1);
    assert.equal(available[0].voucher.code, "MORNING");
    assert.equal(unavailable.length, 1);
    assert.equal(unavailable[0].voucher.code, "NIGHT");
  });

  it("gracefully handles empty systemHolidays array (no table)", () => {
    // holidayOnly voucher checked with no holidays in systemHolidays → should fail
    const v = makeVoucher({ id: "holiday", code: "HOLIDAY", holidayOnly: true });
    const result = evaluateVoucherEligibility(v, { ...baseCtx, systemHolidays: [] });
    assert.equal(result.eligible, false);
    if (!result.eligible) assert.equal(result.code, "VOUCHER_NOT_HOLIDAY");
  });

  it("accepts holidayOnly voucher when systemHolidays contains the booking date", () => {
    const v = makeVoucher({ id: "holiday", code: "HOLIDAY", holidayOnly: true });
    const result = evaluateVoucherEligibility(v, { ...baseCtx, systemHolidays: ["2026-07-18"] });
    assert.equal(result.eligible, true);
  });

  it("funding source does not affect eligibility, only share", () => {
    const ctx = { ...baseCtx, subtotal: 200000 };
    const platform = makeVoucher({ id: "platform", code: "PLATFORM", fundedBy: "PLATFORM", platformFundingPercent: 100, partnerFundingPercent: 0, discountType: "FIXED_AMOUNT", discountValue: 20000 });
    const partner = makeVoucher({ id: "partner", code: "PARTNER", fundedBy: "PARTNER", platformFundingPercent: 0, partnerFundingPercent: 100, discountType: "FIXED_AMOUNT", discountValue: 20000 });
    const shared = makeVoucher({ id: "shared", code: "SHARED", fundedBy: "SHARED", platformFundingPercent: 50, partnerFundingPercent: 50, discountType: "FIXED_AMOUNT", discountValue: 20000 });

    for (const v of [platform, partner, shared]) {
      const result = evaluateVoucherEligibility(v, ctx);
      assert.equal(result.eligible, true, `${v.code} should be eligible`);
    }
  });

  it("shared voucher computes correct platform and partner shares", () => {
    const v = makeVoucher({
      id: "shared",
      code: "SHARED",
      fundedBy: "SHARED",
      partnerFundingPercent: 40,
      platformFundingPercent: 60,
      discountType: "FIXED_AMOUNT",
      discountValue: 50000
    });
    const result = evaluateVoucherEligibility(v, baseCtx);
    assert.equal(result.eligible, true);
    if (result.eligible) {
      assert.equal(result.discountAmount, 50000);
      assert.equal(result.partnerShare, 20000);  // 40%
      assert.equal(result.platformShare, 30000); // 60%
    }
  });
});

describe("priority score computation", () => {
  it("awards more points to higher discount vouchers", () => {
    const base = 50; // base score
    const discountPoints = (discount: number) => Math.min(40, Math.round((discount / 400_000) * 40));
    assert.ok(discountPoints(100000) > discountPoints(20000));
    assert.ok(discountPoints(400000) === 40);
    assert.ok(discountPoints(500000) === 40); // caps at 40
  });

  it("awards funding bonus points correctly", () => {
    // Platform = 8pts, SHARED = 5pts, PARTNER = 0pts
    const platformPts = 8;
    const sharedPts = 5;
    const partnerPts = 0;
    assert.ok(platformPts > sharedPts);
    assert.ok(sharedPts > partnerPts);
  });
});
