import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateDemandScore,
  calculateBookingPrice,
  calculateDynamicPrice,
  calculateOccupancyRate,
  calculateRevenueLift,
  calculateVoucherDiscount,
  checkBookingOverlap,
  canCancelBooking,
  canCreateReview,
  isTournamentRegistrationAllowed
} from "./businessRules.js";

describe("business rules", () => {
  it("calculates dynamic pricing with a peak-hour percentage rule", () => {
    const result = calculateDynamicPrice({
      basePrice: 200000,
      rules: [{ ruleName: "Peak hour", type: "PERCENTAGE", value: 20 }]
    });
    assert.equal(result.finalPrice, 240000);
    assert.equal(result.dynamicAdjustmentAmount, 40000);
  });

  it("caps voucher discount by max discount amount", () => {
    const result = calculateVoucherDiscount({
      subtotal: 300000,
      discountType: "PERCENTAGE",
      discountValue: 10,
      maxDiscountAmount: 20000,
      minBookingAmount: 0
    });
    assert.deepEqual(result, { discountAmount: 20000, finalTotal: 280000 });
  });

  it("marks high weekend peak-hour demand as VERY_HIGH", () => {
    const result = calculateDemandScore({
      totalHistoricalBookings: 60,
      matchingSlotBookings: 10,
      averageBookingsPerComparableSlot: 4,
      isWeekend: true,
      isPeakHour: true
    });
    assert.equal(result.status, "GENERATED");
    assert.equal(result.predictionLevel, "VERY_HIGH");
  });

  it("marks low weekday morning demand as LOW", () => {
    const result = calculateDemandScore({
      totalHistoricalBookings: 60,
      matchingSlotBookings: 1,
      averageBookingsPerComparableSlot: 4,
      isWeekend: false,
      isPeakHour: false
    });
    assert.equal(result.status, "GENERATED");
    assert.equal(result.predictionLevel, "LOW");
  });

  it("returns INSUFFICIENT_DATA when booking history is below threshold", () => {
    const result = calculateDemandScore({
      totalHistoricalBookings: 19,
      matchingSlotBookings: 10,
      averageBookingsPerComparableSlot: 4,
      isWeekend: true,
      isPeakHour: true
    });
    assert.equal(result.status, "INSUFFICIENT_DATA");
  });

  it("detects booking overlap", () => {
    assert.equal(checkBookingOverlap({ existing: [{ startTime: "18:00", endTime: "20:00" }], startTime: "19:00", endTime: "21:00" }), true);
    assert.equal(checkBookingOverlap({ existing: [{ startTime: "18:00", endTime: "20:00" }], startTime: "20:00", endTime: "21:00" }), false);
  });

  it("calculates booking price totals", () => {
    assert.deepEqual(
      calculateBookingPrice({ basePrice: 100000, dynamicAdjustmentAmount: 20000, hours: 2, serviceTotal: 30000, voucherDiscountAmount: 50000 }),
      { basePrice: 200000, dynamicAdjustmentAmount: 40000, subtotal: 270000, voucherDiscountAmount: 50000, totalPrice: 220000 }
    );
  });

  it("allows cancellation when policy window is satisfied", () => {
    assert.equal(
      canCancelBooking({
        startsAt: new Date("2026-06-18T21:00:00.000Z"),
        now: new Date("2026-06-18T18:00:00.000Z"),
        minimumHoursBeforeStart: 2
      }),
      true
    );
  });

  it("allows one review only for completed bookings", () => {
    assert.equal(canCreateReview({ bookingStatus: "COMPLETED", existingReviewForBooking: false }), true);
    assert.equal(canCreateReview({ bookingStatus: "PENDING", existingReviewForBooking: false }), false);
    assert.equal(canCreateReview({ bookingStatus: "COMPLETED", existingReviewForBooking: true }), false);
  });

  it("calculates occupancy and revenue lift", () => {
    assert.equal(calculateOccupancyRate({ bookedSlots: 5, totalSlots: 10 }), 0.5);
    assert.equal(calculateRevenueLift({ fixedRevenue: 1000000, dynamicRevenue: 1200000 }), 0.2);
  });

  it("blocks duplicate tournament registrations", () => {
    const result = isTournamentRegistrationAllowed({
      status: "OPEN",
      registrationDeadline: new Date("2026-12-31T00:00:00.000Z"),
      currentParticipants: 1,
      maxParticipants: 10,
      alreadyRegistered: true,
      now: new Date("2026-06-13T00:00:00.000Z")
    });
    assert.deepEqual(result, { allowed: false, reason: "ALREADY_REGISTERED" });
  });
});
