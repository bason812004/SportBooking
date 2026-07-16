/**
 * Unit tests for the pure voucher eligibility engine.
 * Covers: weekends, nights, holidays, expired, time-of-day, day-of-week,
 * min-amount, status, usage-limit, applicable-date-range, funding splits
 * (PLATFORM, PARTNER, SHARED).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateVoucherEligibility,
  translateReason,
  type VoucherLike
} from "./voucher.eligibility.js";

const NOW_REFERENCE = new Date("2026-07-15T10:00:00.000Z");

function buildBaseVoucher(overrides: Partial<VoucherLike> = {}): VoucherLike {
  return {
    id: "v_test",
    code: "TEST10",
    discountType: "PERCENTAGE",
    discountValue: 10,
    maxDiscountAmount: 50000,
    minBookingAmount: 0,
    usageLimit: 100,
    usedCount: 0,
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T23:59:59.000Z"),
    status: "ACTIVE",
    fundedBy: "PARTNER",
    partnerFundingPercent: 100,
    platformFundingPercent: 0,
    ...overrides
  };
}

const baseContext = {
  bookingDate: "2026-07-18", // Saturday
  startTime: "08:00",
  endTime: "10:00",
  courtId: "court-1",
  subtotal: 200000
};

describe("voucher eligibility - lifecycle guards", { concurrency: false }, () => {
  it("rejects missing voucher", () => {
    const r = evaluateVoucherEligibility(null, baseContext, "en");
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_NOT_FOUND");
  });

  it("rejects inactive voucher", () => {
    const v = buildBaseVoucher({ status: "INACTIVE" });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_INACTIVE");
  });

  it("rejects voucher that has not started", () => {
    const v = buildBaseVoucher({
      startDate: new Date("2030-01-01T00:00:00.000Z"),
      endDate: new Date("2030-12-31T00:00:00.000Z")
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_NOT_STARTED");
  });

  it("rejects expired voucher", () => {
    const v = buildBaseVoucher({
      startDate: new Date("2020-01-01T00:00:00.000Z"),
      endDate: new Date("2020-12-31T00:00:00.000Z")
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_EXPIRED");
  });

  it("rejects voucher that has reached usage limit", () => {
    const v = buildBaseVoucher({ usageLimit: 10, usedCount: 10 });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_USAGE_LIMIT_REACHED");
  });

  it("rejects voucher below minimum booking amount", () => {
    const v = buildBaseVoucher({ minBookingAmount: 500000 });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_MIN_BOOKING_AMOUNT");
  });
});

describe("voucher eligibility - day of week", () => {
  it("rejects when booking date is outside allowed weekdays", () => {
    const v = buildBaseVoucher({ applicableDays: "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY" });
    const r = evaluateVoucherEligibility(v, baseContext); // Saturday
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_WRONG_DAY");
  });

  it("accepts when booking date is on an allowed weekday", () => {
    const v = buildBaseVoucher({ applicableDays: "SATURDAY,SUNDAY" });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, true);
  });

  it("tolerates whitespace and case in applicableDays", () => {
    const v = buildBaseVoucher({ applicableDays: " satUrday , sunday " });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, true);
  });
});

describe("voucher eligibility - time of day", () => {
  it("accepts when slot fully inside time window", () => {
    const v = buildBaseVoucher({ startTime: "06:00:00", endTime: "12:00:00" });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, true);
  });

  it("rejects when slot does not overlap time window", () => {
    const v = buildBaseVoucher({ startTime: "22:00:00", endTime: "23:59:00" });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_WRONG_TIME");
  });

  it("rejects when slot only partially overlaps the boundary", () => {
    const v = buildBaseVoucher({ startTime: "10:00:00", endTime: "12:00:00" });
    const r = evaluateVoucherEligibility(v, baseContext); // 08:00 - 10:00
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_WRONG_TIME");
  });

  it("accepts night-only voucher for late slot", () => {
    const v = buildBaseVoucher({ startTime: "18:00:00", endTime: "23:59:00" });
    const r = evaluateVoucherEligibility(v, { ...baseContext, startTime: "19:00", endTime: "21:00" });
    assert.equal(r.eligible, true);
  });
});

describe("voucher eligibility - holiday window", () => {
  it("accepts holiday-only voucher when system holiday matches", () => {
    const v = buildBaseVoucher({ holidayOnly: true });
    const r = evaluateVoucherEligibility(v, {
      ...baseContext,
      bookingDate: "2026-09-02",
      systemHolidays: ["2026-09-02"]
    });
    assert.equal(r.eligible, true);
  });

  it("rejects holiday-only voucher on regular day", () => {
    const v = buildBaseVoucher({ holidayOnly: true });
    const r = evaluateVoucherEligibility(v, baseContext, "en");
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_NOT_HOLIDAY");
  });

  it("accepts holiday-only voucher when explicit holidayDates match", () => {
    const v = buildBaseVoucher({
      holidayOnly: true,
      holidayDates: ["2026-12-25", "2026-12-31"]
    });
    const r = evaluateVoucherEligibility(v, {
      ...baseContext,
      bookingDate: "2026-12-25",
      systemHolidays: []
    });
    assert.equal(r.eligible, true);
  });
});

describe("voucher eligibility - applicable date range", () => {
  it("rejects when booking date is before applicableStartDate", () => {
    const v = buildBaseVoucher({
      applicableStartDate: new Date("2026-08-01T00:00:00.000Z"),
      applicableEndDate: new Date("2026-09-30T00:00:00.000Z")
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_APPLICABLE_START_DATE");
  });

  it("rejects when booking date is after applicableEndDate", () => {
    const v = buildBaseVoucher({
      applicableStartDate: new Date("2026-01-01T00:00:00.000Z"),
      applicableEndDate: new Date("2026-06-30T00:00:00.000Z")
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, false);
    if (!r.eligible) assert.equal(r.code, "VOUCHER_APPLICABLE_END_DATE");
  });
});

describe("voucher eligibility - happy paths & discounts", () => {
  it("computes percentage discount and respects maxDiscountAmount cap", () => {
    const v = buildBaseVoucher({
      discountType: "PERCENTAGE",
      discountValue: 50,
      maxDiscountAmount: 50000
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, true);
    if (r.eligible) {
      assert.equal(r.discountAmount, 50000);
      assert.equal(r.finalAmount, 150000);
    }
  });

  it("computes FIXED_AMOUNT discount and final total never goes negative", () => {
    const v = buildBaseVoucher({
      discountType: "FIXED_AMOUNT",
      discountValue: 50000
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, true);
    if (r.eligible) {
      // discount is capped to subtotal (200000)
      assert.equal(r.discountAmount, 50000);
      assert.equal(r.finalAmount, 150000);
    }
  });

  it("caps FIXED_AMOUNT discount at the booking subtotal", () => {
    const v = buildBaseVoucher({
      discountType: "FIXED_AMOUNT",
      discountValue: 999999,
      maxDiscountAmount: null
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, true);
    if (r.eligible) {
      assert.equal(r.discountAmount, 200000);
      assert.equal(r.finalAmount, 0);
    }
  });
});

describe("voucher eligibility - funding splits", () => {
  it("PARTNER funding => partnerShare = discount, platformShare = 0", () => {
    const v = buildBaseVoucher({
      fundedBy: "PARTNER",
      partnerFundingPercent: 100,
      platformFundingPercent: 0,
      discountType: "FIXED_AMOUNT",
      discountValue: 50000
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, true);
    if (r.eligible) {
      assert.equal(r.partnerShare, 50000);
      assert.equal(r.platformShare, 0);
    }
  });

  it("PLATFORM funding => partnerShare = 0, platformShare = discount", () => {
    const v = buildBaseVoucher({
      fundedBy: "PLATFORM",
      partnerFundingPercent: 0,
      platformFundingPercent: 100,
      discountType: "FIXED_AMOUNT",
      discountValue: 40000
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, true);
    if (r.eligible) {
      assert.equal(r.partnerShare, 0);
      assert.equal(r.platformShare, 40000);
    }
  });

  it("SHARED funding splits per configured percentages", () => {
    const v = buildBaseVoucher({
      fundedBy: "SHARED",
      partnerFundingPercent: 30,
      platformFundingPercent: 70,
      discountType: "FIXED_AMOUNT",
      discountValue: 50000
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, true);
    if (r.eligible) {
      assert.equal(r.partnerShare, 15000);
      assert.equal(r.platformShare, 35000);
      assert.equal(r.partnerShare + r.platformShare, 50000);
    }
  });

  it("handles rounding when shares do not divide evenly", () => {
    const v = buildBaseVoucher({
      fundedBy: "SHARED",
      partnerFundingPercent: 33,
      platformFundingPercent: 67,
      discountType: "FIXED_AMOUNT",
      discountValue: 100
    });
    const r = evaluateVoucherEligibility(v, baseContext);
    assert.equal(r.eligible, true);
    if (r.eligible) {
      assert.equal(r.partnerShare + r.platformShare, 100);
      assert.equal(r.partnerShare, 33);
      assert.equal(r.platformShare, 67);
    }
  });
});

describe("voucher eligibility - translations", () => {
  it("provides Vietnamese reason messages", () => {
    const text = translateReason("VOUCHER_EXPIRED", "vi");
    assert.match(text, /hết thời gian/);
  });

  it("provides English reason messages", () => {
    const text = translateReason("VOUCHER_EXPIRED", "en");
    assert.match(text, /expired/i);
  });

  it("defaults to Vietnamese", () => {
    const text = translateReason("VOUCHER_WRONG_DAY");
    assert.match(text, /ngày/);
  });
});