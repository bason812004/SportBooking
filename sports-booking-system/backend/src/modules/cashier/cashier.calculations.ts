import { timeToMinutes } from "../../shared/utils/time.js";

type PlayTimes = { bookingDate: Date | string; startTime: Date | string; endTime: Date | string };

/** Booking dates/times are wall-clock values in Vietnam, independent of server TZ. */
function playInstants(booking: PlayTimes) {
  const date = booking.bookingDate instanceof Date ? booking.bookingDate.toISOString().slice(0, 10) : booking.bookingDate.slice(0, 10);
  const minutes = (time: Date | string) => timeToMinutes(time instanceof Date ? time.toISOString().slice(11, 16) : time.slice(0, 5));
  const midnight = new Date(`${date}T00:00:00+07:00`).getTime();
  return { start: midnight + minutes(booking.startTime) * 60000, end: midnight + minutes(booking.endTime) * 60000 };
}

/** Services can be sold from 30 minutes before the booked time until an hour after it. */
export function nowWithinPlayWindow(booking: PlayTimes, now = new Date()) {
  const { start, end } = playInstants(booking);
  return now.getTime() >= start - 30 * 60000 && now.getTime() <= end + 60 * 60000;
}

/** The booked time has begun, so selling a service checks the customer in. */
export function playHasStarted(booking: PlayTimes, now = new Date()) {
  return now.getTime() >= playInstants(booking).start;
}

export type PrepaidKind = "NONE" | "DEPOSIT" | "COURT_FULL";

/**
 * What the money paid before the session (online, or the deposit) covered, for the counter's bill: nothing, part of
 * the court (a deposit: the rest of the court is still due with the services) or the whole court (only the services
 * are due). The amounts themselves come from the bill; this only names the case.
 */
export function prepaidKind(depositPaid: number, courtSubtotal: number, voucherDiscount = 0): PrepaidKind {
  if (depositPaid <= 0) return "NONE";
  return depositPaid >= Math.max(0, courtSubtotal - voucherDiscount) ? "COURT_FULL" : "DEPOSIT";
}
