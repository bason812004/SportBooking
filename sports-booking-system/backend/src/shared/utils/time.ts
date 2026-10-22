import { DayType } from "@prisma/client";

export function parsePage(query: unknown) {
  const value = Number(query);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function parseLimit(query: unknown) {
  const value = Number(query);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 100) : 10;
}

export function toDbDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

export function timeToDate(time: string) {
  return new Date(`1970-01-01T${time}:00.000Z`);
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isFullHour(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) && minutes === 0;
}

export function ceilToFullHour(totalMinutes: number) {
  return Math.ceil(totalMinutes / 60) * 60;
}

export function floorToFullHour(totalMinutes: number) {
  return Math.floor(totalMinutes / 60) * 60;
}

export function durationHours(startTime: string, endTime: string) {
  return (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
}

export function dayTypeFor(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6 ? DayType.WEEKEND : DayType.WEEKDAY;
}

/** Booking dates/times are Vietnam wall-clock values; pin +07:00 so the result does not depend on server TZ. */
export function vietnamWallClock(date: string, time: string) {
  return new Date(`${date.slice(0, 10)}T${time.slice(0, 5)}:00+07:00`);
}

/** Today's date (YYYY-MM-DD) and clock time (HH:mm) in Vietnam. */
export function vietnamNow(now = new Date()) {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** The instant a booking's DATE + TIME columns refer to. Also used with endTime for "after the booking ended". */
export function bookingStartsAt(date: Date, time: Date) {
  return vietnamWallClock(date.toISOString().slice(0, 10), time.toISOString().slice(11, 16));
}
