import assert from "node:assert/strict";
import test from "node:test";

import { isPendingButExpired, startOfWeek } from "./weeklySchedule.repository.js";

test("startOfWeek aligns any input to Monday in UTC", () => {
  assert.equal(startOfWeek("2026-07-22"), "2026-07-20"); // Wed -> Mon
  assert.equal(startOfWeek("2026-07-19"), "2026-07-13"); // Sun -> Mon
  assert.equal(startOfWeek("2026-07-20"), "2026-07-20"); // Mon -> Mon
});

test("isPendingButExpired ignores cancelled/no-show bookings", () => {
  assert.equal(isPendingButExpired({ bookingStatus: "CONFIRMED", payments: [] }), false);
  assert.equal(isPendingButExpired({ bookingStatus: "CANCELLED", payments: [] }), false);
});

test("isPendingButExpired treats pending bookings with no payments as expired", () => {
  assert.equal(isPendingButExpired({ bookingStatus: "PENDING", payments: [] }), false);
  assert.equal(isPendingButExpired({ bookingStatus: "PENDING_PAYMENT", payments: [] }), false);
});

test("isPendingButExpired keeps a booking live when an unpaid payment exists and is not expired", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  assert.equal(
    isPendingButExpired({
      bookingStatus: "PENDING",
      payments: [{ status: "UNPAID", expiresAt: future }]
    }),
    true
  );
});

test("isPendingButExpired frees a slot when the payment has expired", () => {
  const past = new Date(Date.now() - 60 * 1000);
  assert.equal(
    isPendingButExpired({
      bookingStatus: "PENDING",
      payments: [{ status: "UNPAID", expiresAt: past }]
    }),
    false
  );
});