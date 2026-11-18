import { timeToMinutes } from "../../shared/utils/time.js";
import { courtAmount, serviceLineTotal } from "../checkout/checkout.calculations.js";

export type ReportBucket = "day" | "week" | "month";

export function bucketFor(from: string, to: string): ReportBucket {
  const days = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

/** The period a date falls in: the day, the Monday of its week, or its month. */
export function bucketKey(date: Date, bucket: ReportBucket) {
  const iso = date.toISOString().slice(0, 10);
  if (bucket === "day") return iso;
  if (bucket === "month") return iso.slice(0, 7);
  const day = new Date(`${iso}T00:00:00.000Z`);
  const weekday = (day.getUTCDay() + 6) % 7; // Monday = 0
  day.setUTCDate(day.getUTCDate() - weekday);
  return day.toISOString().slice(0, 10);
}

/** Every period of the range in order, so a chart shows a day, week or month without money as 0 instead of skipping it. */
export function rangePeriods(from: string, to: string, bucket: ReportBucket) {
  const periods: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    const key = bucketKey(cursor, bucket);
    if (periods[periods.length - 1] !== key) periods.push(key);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return periods;
}

type ServiceLine = Parameters<typeof serviceLineTotal>[0];

/**
 * Service money of a finished booking that the settlement ledger does not already hold. A PLATFORM settlement's gross is
 * the money the platform received, so what the customer paid online beyond the court (less voucher) was service money
 * and is in "Tổng doanh thu"; services sold at the counter never are. Only the rest of the service lines counts here,
 * so the two figures never overlap.
 */
export function servicesOutsideLedger(booking: {
  basePrice?: unknown;
  dynamicAdjustmentAmount?: unknown;
  totalPrice: unknown;
  voucherDiscountAmount?: unknown;
  services: ServiceLine[];
  platformGross: number;
}) {
  const services = booking.services.reduce((sum, line) => sum + serviceLineTotal(line), 0);
  const courtDue = Math.max(0, courtAmount(booking) - (Number(booking.voucherDiscountAmount) || 0));
  const servicesPaidOnline = Math.max(0, booking.platformGross - courtDue);
  return Math.max(0, services - servicesPaidOnline);
}

/**
 * Sub-court hours a booking fills. A booking for the whole court (no sub-court) fills every sub-court counted for that
 * court; one on a sub-court that is not counted (paused, so not in the hours available) fills none. `counted` maps a
 * court to its counted sub-courts, `[null]` for a court without sub-courts.
 */
export function occupiedSurfaceHours(
  booking: { courtId: string; courtSurfaceId: string | null; startTime: Date; endTime: Date },
  counted: Map<string, Array<string | null>>
) {
  const surfaces = counted.get(booking.courtId) ?? [];
  const filled = booking.courtSurfaceId === null ? surfaces.length : surfaces.filter((id) => id === booking.courtSurfaceId).length;
  const minutes = Math.max(0, timeToMinutes(booking.endTime.toISOString().slice(11, 16)) - timeToMinutes(booking.startTime.toISOString().slice(11, 16)));
  return (filled * minutes) / 60;
}

export type BreakdownCourt = { id: string; name: string; partnerId: string; partnerName: string; approvalStatus: string };
/** One court's share of the settlement ledger for bookings played in the range: settled money and money still waiting. */
export type CourtLedger = { courtId: string; grossAmount: number; commissionAmount: number; netAmount: number; pendingAmount: number };

type BreakdownFigures = { grossAmount: number; commissionAmount: number; netAmount: number; pendingAmount: number; bookings: number };
const noFigures = (): BreakdownFigures => ({ grossAmount: 0, commissionAmount: 0, netAmount: 0, pendingAmount: 0, bookings: 0 });
const byRevenue = <T extends { grossAmount: number; name: string }>(a: T, b: T) => b.grossAmount - a.grossAmount || a.name.localeCompare(b.name, "vi");

/**
 * Revenue per court and per partner for the admin report, from the same ledger and booking counts as the overview, so
 * the rows add up to the whole-system figures. Every approved court is listed (0 when nothing happened); a court still
 * pending or rejected only when it has money or bookings in the range. A partner's row adds up its listed courts.
 */
export function revenueBreakdown(courts: BreakdownCourt[], ledger: CourtLedger[], bookingCounts: Array<{ courtId: string; bookings: number }>) {
  const figures = new Map<string, BreakdownFigures>();
  const of = (courtId: string) => {
    let entry = figures.get(courtId);
    if (!entry) figures.set(courtId, (entry = noFigures()));
    return entry;
  };
  for (const row of ledger) {
    const entry = of(row.courtId);
    entry.grossAmount += row.grossAmount;
    entry.commissionAmount += row.commissionAmount;
    entry.netAmount += row.netAmount;
    entry.pendingAmount += row.pendingAmount;
  }
  for (const row of bookingCounts) of(row.courtId).bookings += row.bookings;

  const active = (entry?: BreakdownFigures) => Boolean(entry && (entry.grossAmount || entry.pendingAmount || entry.bookings));
  const courtRows = courts
    .filter((court) => court.approvalStatus === "APPROVED" || active(figures.get(court.id)))
    .map((court) => ({
      courtId: court.id,
      name: court.name,
      partnerId: court.partnerId,
      partnerName: court.partnerName,
      approvalStatus: court.approvalStatus,
      ...(figures.get(court.id) ?? noFigures())
    }))
    .sort(byRevenue);

  const partners = new Map<string, BreakdownFigures & { partnerId: string; name: string; courtCount: number }>();
  for (const court of courtRows) {
    let partner = partners.get(court.partnerId);
    if (!partner) partners.set(court.partnerId, (partner = { partnerId: court.partnerId, name: court.partnerName, courtCount: 0, ...noFigures() }));
    partner.courtCount += 1;
    partner.grossAmount += court.grossAmount;
    partner.commissionAmount += court.commissionAmount;
    partner.netAmount += court.netAmount;
    partner.pendingAmount += court.pendingAmount;
    partner.bookings += court.bookings;
  }
  return { partners: Array.from(partners.values()).sort(byRevenue), courts: courtRows };
}
