import assert from "node:assert/strict";
import { test } from "node:test";
import { adminBookingChanges } from "./admin.bookingUpdate.js";

const inProgress = { bookingStatus: "IN_PROGRESS", paymentStatus: "PENDING" };

test("unchanged statuses resent by the form are dropped, so a note saves on any booking", () => {
  assert.deepEqual(
    adminBookingChanges(inProgress, { bookingStatus: "IN_PROGRESS", paymentStatus: "PENDING", adminNote: "Khách gọi lại" }),
    { adminNote: "Khách gọi lại" }
  );
});

test("resending only the current statuses is not a change", () => {
  assert.throws(() => adminBookingChanges(inProgress, { bookingStatus: "IN_PROGRESS", paymentStatus: "PENDING" }), /Khong co thay doi/);
});

test("a finished booking keeps its status, but its payment and refund can still be handled", () => {
  const completed = { bookingStatus: "COMPLETED", paymentStatus: "PAID" };
  assert.throws(() => adminBookingChanges(completed, { bookingStatus: "PENDING" }), /da ket thuc/);
  assert.deepEqual(adminBookingChanges(completed, { paymentStatus: "PARTIALLY_REFUNDED", refundAmount: 50000 }), {
    paymentStatus: "PARTIALLY_REFUNDED",
    refundAmount: 50000
  });
});

test("admins can only set the manual statuses", () => {
  assert.equal(adminBookingChanges(inProgress, { bookingStatus: "COMPLETED" }).bookingStatus, "COMPLETED");
  assert.throws(() => adminBookingChanges({ bookingStatus: "CONFIRMED", paymentStatus: "PAID" }, { bookingStatus: "IN_PROGRESS" }), /chuyen don/);
  assert.throws(() => adminBookingChanges(inProgress, { paymentStatus: "PROCESSING" }), /chuyen thanh toan/);
});
