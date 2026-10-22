import { timeToMinutes } from "../../shared/utils/time.js";

/** Booking dates/times are wall-clock values in Vietnam, independent of server TZ. */
export function nowWithinPlayWindow(booking: { bookingDate: Date | string; startTime: Date | string; endTime: Date | string }, now = new Date()) {
  const date = booking.bookingDate instanceof Date ? booking.bookingDate.toISOString().slice(0, 10) : booking.bookingDate.slice(0, 10);
  const minutes = (time: Date | string) => timeToMinutes(time instanceof Date ? time.toISOString().slice(11, 16) : time.slice(0, 5));
  const midnight = new Date(`${date}T00:00:00+07:00`).getTime();
  const start = midnight + minutes(booking.startTime) * 60000;
  const end = midnight + minutes(booking.endTime) * 60000;
  return now.getTime() >= start - 30 * 60000 && now.getTime() <= end + 60 * 60000;
}
