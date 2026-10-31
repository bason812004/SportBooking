/** Bookings still open after their end time: not yet checked in, or checked in but never checked out. */
export const OPEN_BOOKING_STATUSES = ["CONFIRMED", "DEPOSIT_PAID", "IN_PROGRESS", "CHECKOUT_PENDING"] as const;

const CHECKED_IN_STATUSES = ["IN_PROGRESS", "CHECKOUT_PENDING"];

/** How long the partner may turn a no-show the system recorded into a completed booking. */
export const AUTO_NO_SHOW_CORRECTION_DAYS = 7;

/**
 * What the system finishes an overdue booking as, going only by what it knows:
 *  - checked in: the customer was there, so it was played (the rest of the court money counts as collected at the
 *    counter, as when staff close it);
 *  - not checked in but the court fully paid online: nothing is left to collect, so completing it costs nobody;
 *  - otherwise: a no-show, so no commission is charged on money that was never collected.
 */
export function autoFinishStatus(booking: { bookingStatus: string; checkedInAt: Date | null; onlinePaid: number; courtDue: number }) {
  if (CHECKED_IN_STATUSES.includes(booking.bookingStatus) || booking.checkedInAt) return "COMPLETED" as const;
  if (booking.onlinePaid >= booking.courtDue) return "COMPLETED" as const;
  return "NO_SHOW" as const;
}

/** A no-show the system recorded can still be turned into a completed booking for a few days. */
export function canCorrectAutoNoShow(booking: { bookingStatus: string; autoFinishedAt?: Date | null }, now = new Date()) {
  if (booking.bookingStatus !== "NO_SHOW" || !booking.autoFinishedAt) return false;
  return now.getTime() - new Date(booking.autoFinishedAt).getTime() <= AUTO_NO_SHOW_CORRECTION_DAYS * 24 * 60 * 60 * 1000;
}
