/**
 * Shared rules of the inventory history lists: the stock ledger (partner), and what the counter sold and rented out
 * (staff). Dates are Vietnam calendar days, YYYY-MM-DD.
 */

/** The longest span one list can cover, in days (a quarter). */
export const HISTORY_MAX_DAYS = 92;

/** A rental list's status filter: OUT = pieces with customers now (any day), the others by the day they went out. */
export const RENTAL_HISTORY_STATUSES = ["OUT", "RETURNED", "DAMAGED", "LOST", "ALL"] as const;
export type RentalHistoryStatus = (typeof RENTAL_HISTORY_STATUSES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / DAY_MS;
const dayText = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/**
 * The days a list covers: today when nothing is given, one day when only one end is, the two ends swapped when given
 * the wrong way round, and never longer than HISTORY_MAX_DAYS (counted back from the later end).
 */
export function historyRange(from: string | undefined, to: string | undefined, today: string) {
  let start = from ?? to ?? today;
  let end = to ?? from ?? today;
  if (start > end) [start, end] = [end, start];
  if (dayNumber(end) - dayNumber(start) + 1 > HISTORY_MAX_DAYS) start = dayText(dayNumber(end) - HISTORY_MAX_DAYS + 1);
  return { from: start, to: end };
}

/** Page and page size of a list (20 by default, at most 100), with the rows to skip. */
export function pageOf(page?: number, limit?: number) {
  const size = Math.min(100, Math.max(1, Math.trunc(limit ?? 20)));
  const number = Math.max(1, Math.trunc(page ?? 1));
  return { page: number, limit: size, offset: (number - 1) * size };
}

export function paginationOf(total: number, page: { page: number; limit: number }) {
  return { page: page.page, limit: page.limit, total, totalPages: Math.max(1, Math.ceil(total / page.limit)) };
}

/** A search text as an ILIKE pattern, or null for none (% and _ typed by a person match themselves). */
export function likePattern(search?: string) {
  const text = search?.trim();
  return text ? `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : null;
}
