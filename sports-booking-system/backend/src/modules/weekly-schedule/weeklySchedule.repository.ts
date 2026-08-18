import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { toDbDate } from "../../shared/utils/time.js";
import {
  WEEKLY_DEFAULT_CLOSE,
  WEEKLY_DEFAULT_OPEN,
  WEEKLY_RANGE_DAYS,
  WEEKLY_SLOT_MINUTES,
  type InternalWeeklySlot
} from "./weeklySchedule.types.js";

function toMinutes(time: string | undefined | null) {
  if (!time || typeof time !== "string" || !time.includes(":")) return 0;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function fmt(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function parseYmd(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return new Date().toISOString().slice(0, 10);
  if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) return new Date().toISOString().slice(0, 10);
    return dateInput.toISOString().slice(0, 10);
  }
  const str = String(dateInput).trim();
  const clean = str.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const ymd = parseYmd(date);
  const dt = new Date(`${ymd}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function startOfWeek(dateInput: string) {
  const ymd = parseYmd(dateInput);
  const dt = new Date(`${ymd}T00:00:00Z`);
  const day = dt.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

function toIsoTime(value: Date | string | null | undefined): string {
  if (!value) return "00:00";
  if (typeof value === "string") {
    if (value.includes("T")) return value.slice(11, 16);
    return value.slice(0, 5);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "00:00";
    return value.toISOString().slice(11, 16);
  }
  return "00:00";
}

function overlaps(start: string, end: string, otherStart: string, otherEnd: string) {
  return start < otherEnd && end > otherStart;
}

function isPendingButExpired(booking: {
  bookingStatus: string;
  payments?: Array<{ expiresAt: Date | null; status: string } | null> | null;
}) {
  const isPending = booking.bookingStatus === "PENDING" || booking.bookingStatus === "PENDING_PAYMENT";
  if (!isPending) return false;
  const payments = (booking.payments ?? []).filter(Boolean) as Array<{ expiresAt: Date | null; status: string }>;
  const activePayment = payments.find((p) => p.status === "PENDING" || p.status === "UNPAID");
  if (!activePayment) return false;
  return !activePayment.expiresAt || activePayment.expiresAt.getTime() > Date.now();
}

export const weeklyScheduleRepository = {
  async court(courtId: string) {
    const court = await prisma.court.findFirst({
      where: { id: courtId, approvalStatus: "APPROVED", activeStatus: "ACTIVE" },
      select: {
        id: true,
        name: true,
        address: true,
        district: true,
        city: true,
        openingTime: true,
        closingTime: true,
        prices: { select: { price: true } },
        images: { take: 1, orderBy: { sortOrder: "asc" }, select: { imageUrl: true } },
        category: { select: { name: true } },
        surfaces: { select: { id: true, name: true, surface: true, code: true }, orderBy: { sortOrder: "asc" } }
      }
    });
    if (!court) return null;
    const minPrice = court.prices.length ? Math.min(...court.prices.map((price) => Number(price.price))) : 0;
    return { ...court, minPrice };
  },

  availabilityBlocks(courtId: string, fromDate: string, toDate: string, surfaceId?: string) {
    return prisma.courtAvailabilityBlock.findMany({
      where: {
        courtId,
        blockDate: { gte: toDbDate(fromDate), lte: toDbDate(toDate) },
        status: "ACTIVE",
        ...(surfaceId ? { courtSurfaceId: surfaceId } : {})
      },
      select: { id: true, blockDate: true, startTime: true, endTime: true, reason: true, courtSurfaceId: true }
    });
  },

  bookings(courtId: string, fromDate: string, toDate: string, surfaceId?: string) {
    return prisma.booking.findMany({
      where: {
        courtId,
        bookingDate: { gte: toDbDate(fromDate), lte: toDbDate(toDate) },
        bookingStatus: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
        ...(surfaceId ? { courtSurfaceId: surfaceId } : {})
      },
      select: {
        id: true,
        bookingCode: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        bookingStatus: true,
        courtSurfaceId: true,
        payments: { select: { expiresAt: true, status: true } }
      }
    });
  },

  bookingSlots(courtId: string, fromDate: string, toDate: string, surfaceId?: string) {
    return prisma.bookingSlot.findMany({
      where: {
        courtId,
        bookingDate: { gte: toDbDate(fromDate), lte: toDbDate(toDate) },
        booking: { bookingStatus: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] } },
        ...(surfaceId ? { court_surface_id: surfaceId } : {})
      },
      select: {
        id: true,
        bookingId: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        slotPrice: true,
        court_surface_id: true,
        booking: {
          select: {
            bookingStatus: true
          }
        }
      },
      orderBy: { startTime: "asc" }
    });
  },

  buildSlots(
    court: { openingTime?: Date | null; closingTime?: Date | null; minPrice?: number },
    weekStart: string,
    weekEnd: string
  ) {
    const openMins = toMinutes(court.openingTime ? toIsoTime(court.openingTime) : WEEKLY_DEFAULT_OPEN);
    const closeMins = toMinutes(court.closingTime ? toIsoTime(court.closingTime) : WEEKLY_DEFAULT_CLOSE);
    const fallbackBasePrice = Number(court.minPrice ?? 0);

    const slots: InternalWeeklySlot[] = [];
    for (let dayOffset = 0; dayOffset < WEEKLY_RANGE_DAYS; dayOffset += 1) {
      const date = addDays(weekStart, dayOffset);
      for (let minute = openMins; minute < closeMins; minute += WEEKLY_SLOT_MINUTES) {
        const startTime = fmt(minute);
        const endTime = fmt(Math.min(minute + WEEKLY_SLOT_MINUTES, closeMins));
        slots.push({
          date,
          startTime,
          endTime,
          status: "AVAILABLE",
          basePrice: fallbackBasePrice,
          finalPrice: fallbackBasePrice,
          dynamicAdjustmentAmount: 0,
          adjustments: [],
          ruleNames: [],
          predictionLevel: null,
          predictionStatus: "INSUFFICIENT_DATA",
          predictedOccupancyRate: null,
          blockReason: null,
          bookingCode: null,
          bookingId: null,
          bookingStatus: null,
          confidenceScore: null
        });
      }
    }
    return { slots, openMins, closeMins, fallbackBasePrice, weekStart, weekEnd };
  },

  isPendingButExpired
};

export { isPendingButExpired };
