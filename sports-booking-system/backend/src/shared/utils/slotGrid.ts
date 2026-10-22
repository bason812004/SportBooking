import { ceilToFullHour, dayTypeFor, floorToFullHour, timeToMinutes } from "./time.js";

export type SlotStatus = "AVAILABLE" | "PENDING_PAYMENT" | "BOOKED" | "BLOCKED";

export type SlotGridBooking = {
  id: string;
  startTime: Date;
  endTime: Date;
  bookingStatus: string;
  courtSurfaceId?: string | null;
  payments?: Array<{ expiresAt: Date; status: string }>;
};

export type SlotGridBookingSlot = {
  id: string;
  bookingId: string;
  startTime: Date;
  endTime: Date;
  courtSurfaceId?: string | null;
  booking: { bookingStatus: string; payments?: Array<{ expiresAt: Date; status: string }> };
};

export type SlotGridBlock = {
  id: string;
  startTime: Date;
  endTime: Date;
  courtSurfaceId?: string | null;
  reason?: string | null;
};

export type SlotGridPrice = { dayType: string; startTime: Date; endTime: Date; price: unknown };

export type SlotGridSlot = { startTime: string; endTime: string; status: SlotStatus; price: number; bookingId: string | null; blockId: string | null };

function timeText(value: Date) {
  return value.toISOString().slice(11, 16);
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function overlaps(slot: { startTime: string; endTime: string }, item: { startTime: Date; endTime: Date }) {
  return timeToMinutes(slot.startTime) < timeToMinutes(timeText(item.endTime)) && timeToMinutes(slot.endTime) > timeToMinutes(timeText(item.startTime));
}

function slotPrice(slot: { startTime: string; endTime: string }, date: string, prices: SlotGridPrice[]) {
  const dayType = dayTypeFor(date);
  const matched = prices.find(
    (price) =>
      price.dayType === dayType &&
      timeToMinutes(slot.startTime) >= timeToMinutes(timeText(price.startTime)) &&
      timeToMinutes(slot.endTime) <= timeToMinutes(timeText(price.endTime))
  );
  if (matched) return Number(matched.price);
  return prices.length ? Math.min(...prices.map((price) => Number(price.price))) : 0;
}

function isExpiredPaymentHold(item: { payments?: Array<{ expiresAt: Date; status: string }> }) {
  if (!item.payments || item.payments.length === 0) return false;
  const activePayment = item.payments.find((payment) => payment.status === "PENDING" || payment.status === "UNPAID");
  if (!activePayment) return true;
  return activePayment.expiresAt.getTime() <= Date.now();
}

function bookingSlotStatus(item: { bookingStatus: string; payments?: Array<{ expiresAt: Date; status: string }> }) {
  if (item.bookingStatus === "PENDING" || item.bookingStatus === "PENDING_PAYMENT") {
    return isExpiredPaymentHold(item) ? "AVAILABLE" : "PENDING_PAYMENT";
  }
  if (item.bookingStatus === "CONFIRMED" || item.bookingStatus === "COMPLETED") return "BOOKED";
  return "AVAILABLE";
}

/**
 * Builds an hourly slot-status grid between opening/closing time for a court (or, when
 * `courtSurfaceId` is passed, scoped to one court surface — court-wide blocks with a null
 * `courtSurfaceId` still apply to every surface).
 */
export function buildSlotGrid(input: {
  date: string;
  openingTime: Date;
  closingTime: Date;
  bookings: SlotGridBooking[];
  bookingSlots: SlotGridBookingSlot[];
  blocks: SlotGridBlock[];
  prices: SlotGridPrice[];
  courtSurfaceId?: string;
}): SlotGridSlot[] {
  const bookings = input.courtSurfaceId === undefined ? input.bookings : input.bookings.filter((booking) => booking.courtSurfaceId === input.courtSurfaceId);
  const bookingSlots =
    input.courtSurfaceId === undefined ? input.bookingSlots : input.bookingSlots.filter((bookingSlot) => bookingSlot.courtSurfaceId === input.courtSurfaceId);
  const blocks =
    input.courtSurfaceId === undefined
      ? input.blocks
      : input.blocks.filter((block) => block.courtSurfaceId === input.courtSurfaceId || block.courtSurfaceId === null || block.courtSurfaceId === undefined);

  const opening = ceilToFullHour(timeToMinutes(timeText(input.openingTime)));
  const closing = floorToFullHour(timeToMinutes(timeText(input.closingTime)));
  const slots: SlotGridSlot[] = [];

  for (let cursor = opening; cursor < closing; cursor += 60) {
    const slot = { startTime: minutesToTime(cursor), endTime: minutesToTime(cursor + 60) };
    const matchedBookingSlots = bookingSlots.filter((bookingSlot) => overlaps(slot, bookingSlot));
    const matchedBookings = bookings.filter((booking) => overlaps(slot, booking));
    const matchedBlock = blocks.find((block) => overlaps(slot, block));
    const price = slotPrice(slot, input.date, input.prices);

    let status: SlotStatus = "AVAILABLE";
    if (matchedBlock) {
      status = "BLOCKED";
    } else {
      const statuses = [
        ...matchedBookingSlots.map((bs) => bookingSlotStatus({ bookingStatus: bs.booking.bookingStatus, payments: bs.booking.payments })),
        ...matchedBookings.map((b) => bookingSlotStatus(b))
      ];
      if (statuses.includes("BOOKED")) status = "BOOKED";
      else if (statuses.includes("PENDING_PAYMENT")) status = "PENDING_PAYMENT";
    }

    const activeSlot =
      matchedBookingSlots.find((bs) => bookingSlotStatus({ bookingStatus: bs.booking.bookingStatus, payments: bs.booking.payments }) !== "AVAILABLE") ||
      matchedBookingSlots[0];
    const activeBooking = matchedBookings.find((b) => bookingSlotStatus(b) !== "AVAILABLE") || matchedBookings[0];
    const bookingId = activeSlot?.bookingId ?? activeBooking?.id ?? null;

    slots.push({ ...slot, status, price, bookingId, blockId: matchedBlock?.id ?? null });
  }

  return slots;
}
