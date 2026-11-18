import { surfaceShortName } from "../../lib/courtNames";
import type { CashierBooking } from "./api/cashierApi";

/**
 * Where a court session stands at the counter, for display only (the server enforces every rule):
 * - NOT_CHECKED_IN: booked, the customer has not arrived;
 * - PLAYING / OVERTIME: checked in, before / after the booked end; services can still be added;
 * - ENDED: the cashier ended it (the invoice is locked) or a payment started: only the payment is left;
 * - COMPLETED: paid and finished.
 */
export type SessionPhase = "NOT_CHECKED_IN" | "PLAYING" | "OVERTIME" | "ENDED" | "COMPLETED";

export const SESSION_PHASE_META: Record<SessionPhase, { label: string; tone: string }> = {
  NOT_CHECKED_IN: { label: "Chưa check-in", tone: "bg-sky-100 text-sky-800" },
  PLAYING: { label: "Đang chơi", tone: "bg-emerald-100 text-emerald-800" },
  OVERTIME: { label: "Hết giờ", tone: "bg-orange-100 text-orange-800" },
  ENDED: { label: "Chờ thanh toán", tone: "bg-amber-100 text-amber-800" },
  COMPLETED: { label: "Hoàn tất", tone: "bg-slate-200 text-slate-700" }
};

type SessionTimes = Pick<CashierBooking, "bookingDate" | "startTime" | "endTime">;

/** The booked start and end as instants. Booking times are wall-clock values in Vietnam (UTC+7). */
export function sessionInstants(booking: SessionTimes) {
  const day = String(booking.bookingDate).slice(0, 10);
  const at = (time: string) => new Date(`${day}T${time.slice(0, 5)}:00+07:00`).getTime();
  const start = at(booking.startTime);
  let end = at(booking.endTime);
  // A session ending at midnight (or past it) ends on the next day.
  if (end <= start) end += 24 * 60 * 60 * 1000;
  return { start, end };
}

export function sessionPhase(booking: CashierBooking, now: number): SessionPhase {
  if (booking.bookingStatus === "COMPLETED") return "COMPLETED";
  if (booking.invoiceLockedAt || booking.bookingStatus === "CHECKOUT_PENDING") return "ENDED";
  if (!booking.checkedInAt && booking.bookingStatus !== "IN_PROGRESS") return "NOT_CHECKED_IN";
  return now >= sessionInstants(booking).end ? "OVERTIME" : "PLAYING";
}

/** Services can be added or changed until the session is ended. */
export const phaseAllowsServices = (phase: SessionPhase) => phase !== "ENDED" && phase !== "COMPLETED";

function duration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  // A session left open from an earlier day: days say enough.
  if (hours >= 24) return `${Math.floor(hours / 24)} ngày`;
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

/** "còn 25 phút", "quá giờ 10 phút", "bắt đầu sau 1 giờ": how the booked time relates to now. */
export function sessionTimeNote(booking: CashierBooking, phase: SessionPhase, now: number) {
  const { start, end } = sessionInstants(booking);
  if (phase === "PLAYING") return `còn ${duration(end - now)}`;
  if (phase === "OVERTIME") return `quá giờ ${duration(now - end)}`;
  if (phase === "NOT_CHECKED_IN") return now < start ? `bắt đầu sau ${duration(start - now)}` : "đã tới giờ chơi";
  return null;
}

/**
 * The court a session is on. Staff work at one venue, so the sub-court is enough; a partner runs several venues,
 * so the venue follows. A venue without sub-courts shows its own name.
 */
export function sessionCourtLabel(booking: Pick<CashierBooking, "court" | "courtSurface">, role?: string) {
  if (!booking.courtSurface) return { main: booking.court.name, venue: null };
  return { main: surfaceShortName(booking.courtSurface.name, booking.court.name), venue: role === "RECIPIENT" ? null : booking.court.name };
}

export const sessionHours = (booking: Pick<CashierBooking, "startTime" | "endTime">) =>
  `${booking.startTime.slice(0, 5)}–${booking.endTime.slice(0, 5)}`;
