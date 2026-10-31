import { ValidationError } from "../../shared/errors/AppError.js";

/** Statuses an admin may move an open booking to; operational ones (in progress, checkout...) belong to the venue flows. */
export const ADMIN_BOOKING_STATUS_TARGETS = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
/** Settlement and commission are final for these, so their status is locked; refunds go through paymentStatus/refundAmount. */
export const FINAL_BOOKING_STATUSES = ["COMPLETED", "CANCELLED", "NO_SHOW", "REJECTED", "EXPIRED"];
/** Payment statuses an admin may set by hand; the others are driven by the payment provider. */
export const ADMIN_PAYMENT_STATUS_TARGETS = ["UNPAID", "PAID", "PARTIALLY_REFUNDED", "REFUNDED"];

export type AdminBookingUpdate = {
  bookingStatus?: string;
  paymentStatus?: string;
  adminNote?: string;
  cancelReason?: string;
  refundAmount?: number;
  platformRetainedAmount?: number;
  actionNote?: string;
};

const EDITABLE_FIELDS = ["bookingStatus", "paymentStatus", "adminNote", "cancelReason", "refundAmount", "platformRetainedAmount"] as const;

/**
 * Keeps only real changes, so a resent unchanged status neither re-runs settlement side effects nor is audited
 * as a change, and enforces which status moves an admin may make.
 */
export function adminBookingChanges(current: { bookingStatus: string; paymentStatus: string }, input: AdminBookingUpdate) {
  const changes = { ...input };
  if (changes.bookingStatus === current.bookingStatus) delete changes.bookingStatus;
  if (changes.paymentStatus === current.paymentStatus) delete changes.paymentStatus;

  if (changes.bookingStatus !== undefined) {
    if (FINAL_BOOKING_STATUSES.includes(current.bookingStatus)) {
      throw new ValidationError("Don da ket thuc, khong the doi trang thai don");
    }
    if (!ADMIN_BOOKING_STATUS_TARGETS.includes(changes.bookingStatus)) {
      throw new ValidationError("Admin khong the chuyen don sang trang thai nay");
    }
  }
  if (changes.paymentStatus !== undefined && !ADMIN_PAYMENT_STATUS_TARGETS.includes(changes.paymentStatus)) {
    throw new ValidationError("Admin khong the chuyen thanh toan sang trang thai nay");
  }
  if (!EDITABLE_FIELDS.some((field) => changes[field] !== undefined)) {
    throw new ValidationError("Khong co thay doi nao de luu");
  }
  return changes;
}
