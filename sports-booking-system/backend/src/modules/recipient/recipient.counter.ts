import { BookingStatus, type Booking, type Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { timeToDate, timeToMinutes, vietnamNow } from "../../shared/utils/time.js";
import { dynamicPricingService } from "../dynamic-pricing/dynamicPricing.service.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { earlyCheckInWindow, scaleCourtPrice, toTimeChargePolicy } from "./recipient.calculations.js";

/**
 * Counter work shared by the staff screens and the cashier (used by partners too): hour-by-hour time charges,
 * whether a sub-court is free, and the one check-in rule.
 */

export function dbTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

export function minutesToTime(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function appendNote(note: string | null, line: string) {
  return note ? `${note}\n${line}` : line;
}

export function noteAmount(amount: number) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

/** Bookings that hold their time on a sub-court (a finished one still did). */
export const activeOperationStatuses: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.DEPOSIT_PAID,
  BookingStatus.IN_PROGRESS,
  BookingStatus.CHECKOUT_PENDING,
  BookingStatus.COMPLETED
];

export type PricingPrefetch = Awaited<ReturnType<typeof dynamicPricingService.prefetch>>;

/**
 * Court charge priced hour by hour, exactly like an online booking of the same hourly grid slots: each
 * piece between full hours gets its own base price and dynamic rules, rounded like bookingPricing.
 * A 15:37-16:37 "Bắt đầu ngay" booking is priced as 15:37-16:00 plus 16:00-16:37.
 */
export function walkInCourtPrice(prefetched: PricingPrefetch, date: string, startTime: string, minutes: number) {
  const end = timeToMinutes(startTime) + minutes;
  let basePrice = 0;
  let courtSubtotal = 0;
  for (let cursor = timeToMinutes(startTime); cursor < end; ) {
    const next = Math.min(end, (Math.floor(cursor / 60) + 1) * 60);
    const hours = (next - cursor) / 60;
    const price = dynamicPricingService.resolveFromPrefetched(prefetched, { date, startTime: minutesToTime(cursor), endTime: minutesToTime(next) });
    basePrice += Math.round(price.basePrice * hours);
    courtSubtotal += Math.round(price.finalPrice * hours);
    cursor = next;
  }
  return { basePrice, dynamicAdjustmentAmount: courtSubtotal - basePrice, courtSubtotal };
}

export async function courtTimeChargePolicy(courtId: string) {
  const court = await prisma.court.findUnique({
    where: { id: courtId },
    select: { earlyFreeMinutes: true, earlyMaxMinutes: true, earlyPricePercent: true, extensionPricePercent: true }
  });
  if (!court) throw new NotFoundError("Không tìm thấy cơ sở được giao quản lý");
  return toTimeChargePolicy(court);
}

/** Charge for `minutes` of extra play from `startTime`: the hour-by-hour court price times the partner's %. */
export function extraTimeCharge(prefetched: PricingPrefetch, date: string, startTime: string, minutes: number, percent: number) {
  if (minutes <= 0) return { amount: 0, basePrice: 0, dynamicAdjustmentAmount: 0 };
  return scaleCourtPrice(walkInCourtPrice(prefetched, date, startTime, minutes), percent);
}

/** A sub-court's opening hours: its own when the partner set them, otherwise the court's. */
export async function surfaceHours(courtId: string, courtSurfaceId: string | null) {
  const [court, surface] = await Promise.all([
    prisma.court.findUnique({ where: { id: courtId }, select: { openingTime: true, closingTime: true } }),
    courtSurfaceId ? prisma.courtSurface.findFirst({ where: { id: courtSurfaceId, courtId }, select: { openingTime: true, closingTime: true } }) : null
  ]);
  if (!court) throw new NotFoundError("Không tìm thấy cơ sở được giao quản lý");
  return {
    opening: dbTime(surface?.openingTime ?? court.openingTime),
    closing: dbTime(surface?.closingTime ?? court.closingTime)
  };
}

/**
 * What holds a sub-court between two times of a day: another booking ("BOOKED") or an active block ("BLOCKED"), on
 * that sub-court or on the whole court. Null when it is free.
 */
export async function slotTakenBy(
  client: Prisma.TransactionClient,
  slot: { courtId: string; courtSurfaceId: string | null; date: Date; startTime: Date; endTime: Date; excludeBookingId?: string }
) {
  const surfaceFilter = slot.courtSurfaceId ? [{ courtSurfaceId: slot.courtSurfaceId }, { courtSurfaceId: null }] : undefined;
  const overlap = { startTime: { lt: slot.endTime }, endTime: { gt: slot.startTime } };
  const booking = await client.booking.findFirst({
    where: {
      ...(slot.excludeBookingId ? { id: { not: slot.excludeBookingId } } : {}),
      courtId: slot.courtId,
      OR: surfaceFilter,
      bookingDate: slot.date,
      bookingStatus: { in: activeOperationStatuses },
      ...overlap
    },
    select: { id: true }
  });
  if (booking) return "BOOKED" as const;
  const block = await client.courtAvailabilityBlock.findFirst({
    where: { courtId: slot.courtId, status: "ACTIVE", OR: surfaceFilter, blockDate: slot.date, ...overlap },
    select: { id: true }
  });
  return block ? ("BLOCKED" as const) : null;
}

const CHECK_IN_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID];
/** A late customer can still be checked in until this long after the booked end. */
const LATE_CHECK_IN_MINUTES = 60;

/**
 * The one check-in rule, for the cashier and the staff counter screen alike. Only a confirmed or deposit-paid
 * booking, on its day, until an hour after its end; it becomes IN_PROGRESS and keeps its payment and deposit. On time
 * or late it simply starts. Before its start the partner's policy applies: how early at most, how many minutes are
 * free, the rest charged at the early % from now; the start then moves to now, if the sub-court is free until then.
 * The caller has checked the booking belongs to the actor.
 */
export async function checkInBooking(booking: Booking) {
  if (booking.checkedInAt) throw new ConflictError("Khách đã check-in đơn này rồi", "ALREADY_CHECKED_IN");
  if (!CHECK_IN_STATUSES.includes(booking.bookingStatus)) {
    throw new ValidationError("Chỉ check-in được đơn đã xác nhận hoặc đã đặt cọc và chưa kết thúc");
  }
  // Vietnam time, whatever timezone the server runs in.
  const { date: today, time: currentTime } = vietnamNow();
  const date = booking.bookingDate.toISOString().slice(0, 10);
  if (date !== today) throw new ValidationError("Chỉ check-in được đơn của hôm nay");
  const nowMinutes = timeToMinutes(currentTime);
  const startMinutes = timeToMinutes(dbTime(booking.startTime));
  if (nowMinutes > timeToMinutes(dbTime(booking.endTime)) + LATE_CHECK_IN_MINUTES) {
    throw new ValidationError("Đơn đã quá giờ chơi hơn 1 tiếng, không check-in được nữa");
  }

  const { updated, extraChargeAmount, earlyCheckIn } = await prisma.$transaction(
    async (tx) => {
      const guard = { id: booking.id, bookingStatus: booking.bookingStatus, checkedInAt: null, startTime: booking.startTime };
      const started = { checkedInAt: new Date(), bookingStatus: BookingStatus.IN_PROGRESS };
      if (nowMinutes >= startMinutes) {
        const { count } = await tx.booking.updateMany({ where: guard, data: started });
        if (!count) throw new ConflictError("Đơn vừa được cập nhật ở nơi khác, hãy tải lại trang");
        return { updated: await tx.booking.findUniqueOrThrow({ where: { id: booking.id } }), extraChargeAmount: 0, earlyCheckIn: null };
      }

      const policy = await courtTimeChargePolicy(booking.courtId);
      const early = earlyCheckInWindow(policy, nowMinutes, startMinutes);
      if (!early.allowed) {
        throw new ValidationError(
          early.maxMinutes === 0
            ? "Sân này không cho check-in sớm, khách vui lòng đợi đến giờ đặt"
            : `Chỉ được check-in sớm tối đa ${early.maxMinutes} phút trước giờ đặt. Khách đến sớm ${early.earlyMinutes} phút, vui lòng đợi thêm ${early.earlyMinutes - early.maxMinutes!} phút`
        );
      }
      const newStartTime = timeToDate(currentTime);
      const taken = await slotTakenBy(tx, {
        courtId: booking.courtId,
        courtSurfaceId: booking.courtSurfaceId,
        date: booking.bookingDate,
        startTime: newStartTime,
        endTime: booking.startTime,
        excludeBookingId: booking.id
      });
      if (taken) {
        throw new ConflictError(
          taken === "BLOCKED" ? "Sân đang trong lịch khoá, chưa check-in sớm được" : "Sân đang có khách, chưa check-in sớm được",
          "EARLY_CHECK_IN_CONFLICT"
        );
      }

      // Only the minutes before the free ones are charged; they run from now. Collected at checkout.
      const charge = early.chargedMinutes
        ? extraTimeCharge(await dynamicPricingService.prefetch(booking.courtId), date, currentTime, early.chargedMinutes, policy.earlyPricePercent)
        : { amount: 0, basePrice: 0, dynamicAdjustmentAmount: 0 };
      const note = early.chargedMinutes
        ? `Check-in sớm ${early.earlyMinutes} phút (miễn phí ${early.freeMinutes} phút, tính ${early.chargedMinutes} phút x ${policy.earlyPricePercent}% giá giờ): ${noteAmount(charge.amount)}`
        : `Check-in sớm ${early.earlyMinutes} phút (miễn phí)`;
      const { count } = await tx.booking.updateMany({
        where: guard,
        data: {
          ...started,
          startTime: newStartTime,
          basePrice: { increment: charge.basePrice },
          dynamicAdjustmentAmount: { increment: charge.dynamicAdjustmentAmount },
          subtotal: { increment: charge.amount },
          totalPrice: { increment: charge.amount },
          note: appendNote(booking.note, note)
        }
      });
      if (!count) throw new ConflictError("Đơn vừa được cập nhật ở nơi khác, hãy tải lại trang");
      await tx.bookingSlot.updateMany({
        where: { bookingId: booking.id, startTime: booking.startTime },
        data: { startTime: newStartTime, slotPrice: { increment: charge.amount } }
      });
      return { updated: await tx.booking.findUniqueOrThrow({ where: { id: booking.id } }), extraChargeAmount: charge.amount, earlyCheckIn: early };
    },
    { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }
  );

  realtimeService.toBooking(booking.id, "booking:status-changed", { bookingId: booking.id, status: BookingStatus.IN_PROGRESS });
  realtimeService.toCourt(booking.courtId, "court:booking-updated", { bookingId: booking.id, status: BookingStatus.IN_PROGRESS });
  return { ...updated, extraChargeAmount, earlyCheckIn };
}
