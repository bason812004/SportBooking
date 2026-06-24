import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBookingQuote,
  calculateDistanceKm,
  calculateMinimumDeposit,
  canCreateBookingCheckout,
  checkBookingOverlap,
  expirePendingPaymentAndReleaseSlots,
  validateSelectedSlots,
  verifyPaymentWebhookIdempotency
} from "./booking.calculations.js";

test("adjacent slots do not overlap", () => {
  assert.equal(checkBookingOverlap({ startTime: "18:00", endTime: "19:00" }, { startTime: "19:00", endTime: "20:00" }), false);
});

test("intersecting slots overlap", () => {
  assert.equal(checkBookingOverlap({ startTime: "18:00", endTime: "20:00" }, { startTime: "19:00", endTime: "21:00" }), true);
});

test("minimum deposit is 50 percent", () => {
  assert.equal(calculateMinimumDeposit(400000), 200000);
});

test("full payment checkout can use the full total", () => {
  assert.equal(canCreateBookingCheckout({ totalAmount: 400000, paymentType: "FULL_PAYMENT" }), true);
  assert.equal(calculateBookingQuote([{ startTime: "18:00", endTime: "20:00", price: 400000 }]).totalAmount, 400000);
});

test("expired pending payment should release the slot", () => {
  assert.equal(expirePendingPaymentAndReleaseSlots(new Date("2026-06-24T10:00:00.000Z"), new Date("2026-06-24T10:01:00.000Z")), true);
});

test("duplicate webhook transaction is idempotent", () => {
  assert.equal(verifyPaymentWebhookIdempotency("provider-tx-1"), true);
});

test("nearby distance is reasonable", () => {
  const distance = calculateDistanceKm({ latitude: 10.8231, longitude: 106.6297 }, { latitude: 10.8448, longitude: 106.6308 });
  assert.ok(distance > 2.2 && distance < 2.8);
});

test("selected slots must have valid time ranges", () => {
  assert.equal(validateSelectedSlots([{ startTime: "18:00", endTime: "19:00" }]), true);
  assert.equal(validateSelectedSlots([{ startTime: "19:00", endTime: "18:00" }]), false);
});

