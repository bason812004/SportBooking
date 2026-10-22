import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBookingQuote,
  calculateDistanceKm,
  calculateMinimumDeposit,
  canCreateBookingCheckout,
  checkBookingOverlap,
  expirePendingPaymentAndReleaseSlots,
  findStartedSlot,
  validateSelectedSlots,
  verifyPaymentWebhookIdempotency
} from "./booking.calculations.js";
import { vietnamNow } from "../../shared/utils/time.js";

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

test("calculates multiple slot totals accurately with voucher discount", () => {
  const slots = [
    { startTime: "06:00", endTime: "07:00", price: 130000 },
    { startTime: "06:00", endTime: "07:00", price: 130000 },
    { startTime: "06:00", endTime: "07:00", price: 210000 }
  ];
  const quote = calculateBookingQuote(slots, 50000);
  assert.equal(quote.subtotal, 470000);
  assert.equal(quote.voucherDiscountAmount, 50000);
  assert.equal(quote.totalAmount, 420000);
});


test("services are deferred and only discounted court charges require a deposit", () => {
  const quote = calculateBookingQuote([{ startTime: "18:00", endTime: "19:00", price: 200000 }], 20000, 100000, 50);
  assert.equal(quote.minimumDepositAmount, 90000);
  assert.equal(quote.remainingAmount, 190000);
});

test("online booking closes at the slot's start, in Vietnam time", () => {
  const slots = [{ date: "2026-10-01", startTime: "18:00" }];
  assert.equal(findStartedSlot(slots, new Date("2026-10-01T17:59:59+07:00")), undefined);
  assert.deepEqual(findStartedSlot(slots, new Date("2026-10-01T18:00:00+07:00")), slots[0]);
  assert.deepEqual(findStartedSlot(slots, new Date("2026-10-01T18:30:00+07:00")), slots[0]);
  // 18:00 Vietnam is 11:00 UTC; a server reading the wall clock as UTC would wrongly accept this.
  assert.deepEqual(findStartedSlot(slots, new Date("2026-10-01T11:00:00Z")), slots[0]);
});

test("only the slots that have started are flagged, across days", () => {
  const now = new Date("2026-10-01T09:30:00+07:00");
  const slots = [
    { date: "2026-10-02", startTime: "06:00" },
    { date: "2026-10-01", startTime: "10:00" },
    { date: "2026-10-01", startTime: "09:00" }
  ];
  assert.deepEqual(findStartedSlot(slots, now), slots[2]);
  assert.equal(findStartedSlot(slots.slice(0, 2), now), undefined);
});

test("vietnamNow rolls the date over at Vietnam midnight, not UTC midnight", () => {
  assert.deepEqual(vietnamNow(new Date("2026-09-30T17:30:00Z")), { date: "2026-10-01", time: "00:30" });
  assert.deepEqual(vietnamNow(new Date("2026-10-01T16:59:00Z")), { date: "2026-10-01", time: "23:59" });
});
