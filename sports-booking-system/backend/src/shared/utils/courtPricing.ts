import { ValidationError } from "../errors/AppError.js";
import { dayTypeFor, timeToMinutes } from "./time.js";

/** A price row in minutes since midnight; `order` breaks ties between equally narrow rows (the newer one wins). */
export type PriceBand = { dayType: string; start: number; end: number; price: number; order: number };

/** A row of system_holidays: a fixed date, or a day that recurs every year. */
export type HolidayDay = { holidayDate: Date | string; recurring: boolean };

export type PricedPiece = { start: number; end: number; price: number; dayType: string };

const clockMinutes = (value: Date | string) => timeToMinutes(typeof value === "string" ? value.slice(0, 5) : value.toISOString().slice(11, 16));
// A row ending at 00:00 runs to midnight.
const endMinutes = (value: Date | string) => clockMinutes(value) || 24 * 60;

/** Rows as stored (Prisma Time columns or "HH:MM" strings) turned into bands; later rows win ties. */
export function priceBands(
  rows: Array<{ dayType: string; startTime: Date | string; endTime: Date | string; price: unknown; createdAt?: Date | null }>
): PriceBand[] {
  return rows.map((row, index) => ({
    dayType: row.dayType,
    start: clockMinutes(row.startTime),
    end: endMinutes(row.endTime),
    price: Number(row.price),
    order: row.createdAt ? row.createdAt.getTime() : index
  }));
}

export function isHoliday(date: string, holidays: HolidayDay[]) {
  const day = date.slice(0, 10);
  return holidays.some((holiday) => {
    const holidayDay = typeof holiday.holidayDate === "string" ? holiday.holidayDate.slice(0, 10) : holiday.holidayDate.toISOString().slice(0, 10);
    return holidayDay === day || (holiday.recurring && holidayDay.slice(5) === day.slice(5));
  });
}

/** The day types whose prices apply on a date, preferred first: on a holiday its own prices, then the usual ones. */
export function priceDayTypes(date: string, holidays: HolidayDay[]) {
  const usual = dayTypeFor(date.slice(0, 10));
  return isHoliday(date, holidays) ? ["HOLIDAY", usual] : [usual];
}

/**
 * Prices [start, end) piece by piece: it is cut where price bands begin or end, and each piece takes the narrowest
 * band covering it (a 06:00-08:00 band set inside a 06:00-17:00 one is the price of those two hours). On a holiday the
 * holiday bands come first. `missing` lists the pieces no band covers: those minutes cannot be sold.
 */
export function coverWithPrices(bands: PriceBand[], date: string, start: number, end: number, holidays: HolidayDay[] = []) {
  const dayTypes = priceDayTypes(date, holidays);
  const cuts = new Set([start, end]);
  for (const band of bands) {
    if (band.start > start && band.start < end) cuts.add(band.start);
    if (band.end > start && band.end < end) cuts.add(band.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const pieces: PricedPiece[] = [];
  const missing: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    let chosen: PriceBand | undefined;
    for (const dayType of dayTypes) {
      chosen = bands
        .filter((band) => band.dayType === dayType && band.start <= from && band.end >= to)
        .sort((a, b) => a.end - a.start - (b.end - b.start) || b.order - a.order)[0];
      if (chosen) break;
    }
    if (!chosen) {
      const last = missing.at(-1);
      if (last && last.end === from) last.end = to;
      else missing.push({ start: from, end: to });
      continue;
    }
    const last = pieces.at(-1);
    if (last && last.end === from && last.price === chosen.price && last.dayType === chosen.dayType) last.end = to;
    else pieces.push({ start: from, end: to, price: chosen.price, dayType: chosen.dayType });
  }
  return { pieces, missing };
}

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The court charge for [start, end), refused when part of it has no price. */
export function priceOrThrow(bands: PriceBand[], date: string, start: number, end: number, holidays: HolidayDay[] = []) {
  const { pieces, missing } = coverWithPrices(bands, date, start, end, holidays);
  if (missing.length) {
    const gaps = missing.map((gap) => `${clock(gap.start)}-${clock(gap.end)}`).join(", ");
    throw new ValidationError(`Khung giờ ${gaps} ngày ${date.slice(0, 10)} chưa có bảng giá nên không nhận đặt.`);
  }
  return pieces;
}

/** Total of priced pieces, each piece's hourly price times its length. */
export function piecesTotal(pieces: PricedPiece[]) {
  return pieces.reduce((sum, piece) => sum + (piece.price * (piece.end - piece.start)) / 60, 0);
}

/** For the forms: two bands of the same day type that overlap without one containing the other are ambiguous. */
export function conflictingBand(
  candidate: { dayType: string; start: number; end: number },
  others: Array<PriceBand & { id?: string }>
) {
  return others.find((band) => {
    if (band.dayType !== candidate.dayType) return false;
    const overlaps = candidate.start < band.end && candidate.end > band.start;
    if (!overlaps) return false;
    const same = candidate.start === band.start && candidate.end === band.end;
    const nested = (candidate.start >= band.start && candidate.end <= band.end) || (band.start >= candidate.start && band.end <= candidate.end);
    return same || !nested;
  });
}

export const minutesClock = clock;
