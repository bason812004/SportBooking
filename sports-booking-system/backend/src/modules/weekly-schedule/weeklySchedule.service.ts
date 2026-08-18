import { Prisma } from "@prisma/client";
import { NotFoundError } from "../../shared/errors/AppError.js";
import { calculateDemandScore, calculateDynamicPrice } from "../../shared/utils/businessRules.js";
import { dayTypeFor, timeToMinutes } from "../../shared/utils/time.js";
import { prisma } from "../../config/db.js";
import {
  WEEKLY_DEFAULT_CLOSE,
  WEEKLY_DEFAULT_OPEN,
  WEEKLY_SLOT_MINUTES,
  type InternalWeeklySlot,
  type WeeklyBookingEntry,
  type WeeklyDay,
  type WeeklyDynamicPriceEntry,
  type WeeklyMaintenanceEntry,
  type WeeklyScheduleResponse,
  type WeeklySlotRow,
  type WeeklyVoucherEntry
} from "./weeklySchedule.types.js";
import {
  startOfWeek,
  weeklyScheduleRepository
} from "./weeklySchedule.repository.js";
import { voucherRepository, type VoucherRow } from "../vouchers/voucher.repository.js";
import { evaluateVoucherEligibility } from "../vouchers/voucher.eligibility.js";

function isPeakHour(startTime: string) {
  const minutes = timeToMinutes(startTime);
  return minutes >= timeToMinutes("17:00") && minutes < timeToMinutes("21:00");
}

// ---------------------------------------------------------------------------
// Short-lived response cache.
//
// The frontend prefetches the previous, current and next weeks in parallel as
// soon as the calendar mounts. Concurrently fetching the same `(court, week)`
// from multiple tabs (or double-tap navigation) previously caused the pool to
// saturate. A tiny in-memory cache collapses those duplicate queries behind a
// 30-second TTL. Bookings/blocks must stay fresh, so the TTL deliberately
// stays short — the realtime channel will invalidate everything below.
// ---------------------------------------------------------------------------
const responseCache = new Map<string, { expiresAt: number; data: WeeklyScheduleResponse }>();
const RESPONSE_TTL_MS = 30_000;

function cacheKey(courtId: string, weekStart: string, surfaceId?: string) {
  return `${courtId}__${weekStart}__${surfaceId || "ALL"}`;
}

function readCache(key: string) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function writeCache(key: string, data: WeeklyScheduleResponse) {
  if (responseCache.size > 200) responseCache.clear();
  responseCache.set(key, { data, expiresAt: Date.now() + RESPONSE_TTL_MS });
}

export function invalidateWeeklyScheduleCache(courtId?: string, weekStart?: string) {
  responseCache.clear();
}


/**
 * Batch-fetch all pending booking payments in ONE query instead of N queries
 * (one per pending booking/booking-slot).  Result is keyed by bookingId.
 */
async function fetchPendingPayments(bookingIds: string[]): Promise<Map<string, { expiresAt: Date | null; status: string }[]>> {
  if (bookingIds.length === 0) return new Map();
  const rows = await prisma.payment.findMany({
    where: {
      bookingId: { in: bookingIds },
      status: { in: ["PENDING", "UNPAID"] }
    },
    select: { bookingId: true, expiresAt: true, status: true }
  });
  const map = new Map<string, { expiresAt: Date | null; status: string }[]>();
  for (const row of rows) {
    const list = map.get(row.bookingId) ?? [];
    list.push({ expiresAt: row.expiresAt, status: row.status });
    map.set(row.bookingId, list);
  }
  return map;
}

/**
 * Check if a booking blocks the slot on the calendar.
 * CONFIRMED and COMPLETED bookings ALWAYS block.
 * PENDING or PENDING_PAYMENT bookings block as long as their payment is active / not expired.
 */
function hasActivePayment(
  bookingId: string,
  bookingStatus: string,
  paymentMap: Map<string, { expiresAt: Date | null; status: string }[]>
): boolean {
  if (bookingStatus === "CONFIRMED" || bookingStatus === "COMPLETED") {
    return true;
  }
  if (bookingStatus === "PENDING" || bookingStatus === "PENDING_PAYMENT") {
    const payments = paymentMap.get(bookingId);
    if (!payments || payments.length === 0) {
      return true;
    }
    const activePayment = payments.find((p) => p.status === "PENDING" || p.status === "UNPAID");
    if (!activePayment) {
      return true;
    }
    return !activePayment.expiresAt || activePayment.expiresAt.getTime() > Date.now();
  }
  return false;
}

function toIsoTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    if (value.includes("T")) return value.slice(11, 16);
    return value.length >= 5 ? value.slice(0, 5) : value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(11, 16);
  }
  return "";
}

function toIsoDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.length >= 10 ? value.slice(0, 10) : value;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  return "";
}

function addDays(date: string, days: number) {
  const dt = new Date(`${date}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const wd = dt.getUTCDay(); // 0=Sun..6=Sat
  return wd === 0 ? 7 : wd; // ISO weekday: Mon=1..Sun=7
}

function overlaps(start: string, end: string, otherStart: string, otherEnd: string) {
  return start < otherEnd && end > otherStart;
}

function dynamicPriceForHour(
  bundle: WeekPricingBundle,
  date: string,
  startTime: string,
  endTime: string
) {
  const dayType = dayTypeFor(date);
  const basePrices = bundle?.basePrices ?? [];
  const legacyPrices = bundle?.legacyPrices ?? [];
  const rules = bundle?.rules ?? [];

  const basePriceRow =
    basePrices.find(
      (row) =>
        row.dayType === dayType &&
        timeToMinutes(row.startTime) <= timeToMinutes(startTime) &&
        timeToMinutes(row.endTime) >= timeToMinutes(endTime)
    ) ??
    legacyPrices.find(
      (row) =>
        row.dayType === dayType &&
        timeToMinutes(row.startTime) <= timeToMinutes(startTime) &&
        timeToMinutes(row.endTime) >= timeToMinutes(endTime)
    );

  const basePrice = basePriceRow
    ? "basePrice" in basePriceRow
      ? basePriceRow.basePrice
      : basePriceRow.price
    : (bundle?.fallbackBasePrice ?? 0);
  if (basePrice <= 0) {
    return {
      basePrice: 0,
      finalPrice: 0,
      adjustmentsAmount: 0,
      adjustments: [] as Array<{ ruleName: string; type: "PERCENTAGE" | "FIXED_AMOUNT"; value: number; amount: number }>,
      ruleNames: [] as string[]
    };
  }

  const applicableRules = rules.filter((rule) => {
    if (rule.dayType && rule.dayType !== dayType) return false;
    if (rule.startTime && rule.endTime) {
      return timeToMinutes(rule.startTime) <= timeToMinutes(startTime) && timeToMinutes(rule.endTime) >= timeToMinutes(endTime);
    }
    return true;
  });

  const result = calculateDynamicPrice({
    basePrice,
    rules: applicableRules.map((rule) => ({
      ruleName: rule.name,
      type: rule.priceAdjustmentType,
      value: rule.priceAdjustmentValue,
      minPrice: rule.minPrice,
      maxPrice: rule.maxPrice
    }))
  });

  return {
    basePrice: result.basePrice,
    finalPrice: result.finalPrice,
    adjustmentsAmount: result.dynamicAdjustmentAmount,
    adjustments: result.adjustments,
    ruleNames: result.adjustments.map((a) => a.ruleName).filter(Boolean)
  };
}

type WeekPricingBundle = Awaited<
  ReturnType<typeof import("../dynamic-pricing/dynamicPricing.service.js").dynamicPricingService.calculateForWeek>
>;

type WeekDemandBundle = Awaited<
  ReturnType<typeof import("../demand-prediction/demandPrediction.service.js").demandPredictionService.predictForWeek>
>;

function predictHour(
  bundle: WeekDemandBundle,
  date: string,
  startTime: string,
  endTime: string
) {
  const matchingKey = `${startTime}-${endTime}`;
  const matchingSlotBookings = bundle?.matchingCountsByWindow?.[matchingKey] ?? 0;
  const result = calculateDemandScore({
    totalHistoricalBookings: bundle?.totalHistoricalBookings ?? 0,
    matchingSlotBookings,
    averageBookingsPerComparableSlot: bundle?.averageBookingsPerComparableSlot ?? 0,
    isWeekend: dayTypeFor(date) === "WEEKEND",
    isPeakHour: isPeakHour(startTime),
    cancellationCount: bundle?.cancellationCount ?? 0
  });

  return {
    predictedOccupancyRate: result.predictedOccupancyRate ?? null,
    predictionLevel: result.predictionLevel ?? null,
    predictionStatus: result.status,
    confidenceScore: result.status === "INSUFFICIENT_DATA" ? null : result.confidenceScore
  };
}

function projectSlot(slot: InternalWeeklySlot): WeeklySlotRow {
  return {
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    courtSurfaceId: (slot as any).courtSurfaceId ?? null,
    courtSurfaceName: (slot as any).courtSurfaceName ?? null,
    status: slot.status,
    basePrice: slot.basePrice,
    finalPrice: slot.finalPrice,
    dynamicAdjustmentAmount: slot.dynamicAdjustmentAmount,
    adjustments: slot.adjustments,
    ruleNames: slot.ruleNames,
    predictionLevel: slot.predictionLevel,
    predictionStatus: slot.predictionStatus,
    predictedOccupancyRate: slot.predictedOccupancyRate,
    blockReason: slot.blockReason,
    bookingCode: slot.bookingCode
  };
}

async function loadPricingBundle(
  courtId: string,
  court: { openingTime?: Date | null; closingTime?: Date | null; minPrice?: number },
  weekStart: string,
  weekEnd: string,
  openMins: number,
  closeMins: number
): Promise<WeekPricingBundle> {
  try {
    const { dynamicPricingService } = await import("../dynamic-pricing/dynamicPricing.service.js");
    const bundle = await dynamicPricingService.calculateForWeek({
      courtId,
      weekStart,
      weekEnd,
      openMinutes: openMins,
      closeMinutes: closeMins
    });
    if (bundle) return bundle;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[weekly-schedule] pricing bundle failed, using fallback", courtId, error);
    }
  }
  // Minimal fallback so the rest of the page still renders.
  return {
    courtId,
    partnerId: "",
    fallbackBasePrice: Number(court.minPrice ?? 0),
    rules: [],
    basePrices: [],
    legacyPrices: []
  } as WeekPricingBundle;
}

async function loadDemandBundle(courtId: string, weekStart: string, weekEnd: string): Promise<WeekDemandBundle> {
  try {
    const { demandPredictionService } = await import("../demand-prediction/demandPrediction.service.js");
    const bundle = await demandPredictionService.predictForWeek({ courtId, weekStart, weekEnd });
    if (bundle) return bundle;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[weekly-schedule] demand bundle failed, using fallback", courtId, error);
    }
  }
  return {
    courtId,
    partnerId: "",
    totalHistoricalBookings: 0,
    cancellationCount: 0,
    averageBookingsPerComparableSlot: 0,
    matchingCountsByWindow: {}
  } as WeekDemandBundle;
}

function buildVoucherEntry(row: VoucherRow): WeeklyVoucherEntry {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    maxDiscountAmount: row.maxDiscountAmount ? Number(row.maxDiscountAmount) : null,
    minBookingAmount: Number(row.minBookingAmount),
    endDate: toIsoDate(row.endDate),
    usedCount: Number(row.usedCount),
    usageLimit: row.usageLimit,
    startDate: toIsoDate(row.startDate),
    applicableDays: row.applicableDays ?? null,
    startTime: row.startTime ?? null,
    endTime: row.endTime ?? null,
    holidayOnly: Boolean(row.holidayOnly),
    holidayDates: row.holidayDates ?? null,
    applicableStartDate: row.applicableStartDate ? toIsoDate(row.applicableStartDate) : null,
    applicableEndDate: row.applicableEndDate ? toIsoDate(row.applicableEndDate) : null,
    partnerName: row.partner?.businessName ?? null
  };
}

export const weeklyScheduleService = {
  async build(courtId: string, weekStart?: string, surfaceId?: string) {
    const baseDate = weekStart ?? new Date().toISOString().slice(0, 10);
    const monday = startOfWeek(baseDate);
    const key = cacheKey(courtId, monday, surfaceId);
    const cached = readCache(key);
    if (cached) return cached;

    const court = await weeklyScheduleRepository.court(courtId);
    if (!court) throw new NotFoundError("Sân không tồn tại hoặc chưa được duyệt");
    const sunday = addDays(monday, 6);
    const slotShape = weeklyScheduleRepository.buildSlots(court, monday, sunday);

    const currentSurfaceId = surfaceId || (court.surfaces?.[0]?.id ?? null);
    const currentSurfaceName = court.surfaces?.find((s: any) => s.id === currentSurfaceId)?.name || court.name;

    for (const slot of slotShape.slots) {
      (slot as any).courtSurfaceId = currentSurfaceId;
      (slot as any).courtSurfaceName = currentSurfaceName;
    }

    const [blocks, bookings, bookingSlots, pricingBundle, demandBundle] = await Promise.all([
      weeklyScheduleRepository.availabilityBlocks(courtId, monday, sunday, surfaceId),
      weeklyScheduleRepository.bookings(courtId, monday, sunday, surfaceId),
      weeklyScheduleRepository.bookingSlots(courtId, monday, sunday, surfaceId),
      loadPricingBundle(courtId, court, monday, sunday, slotShape.openMins, slotShape.closeMins),
      loadDemandBundle(courtId, monday, sunday)
    ]);

    // Batch-fetch payments for all pending bookings in ONE query.
    // This eliminates N+1: previously each pending booking triggered a nested SELECT.
    const pendingBookingIds = [
      ...bookings
        .filter((b) => b && (b.bookingStatus === "PENDING" || b.bookingStatus === "PENDING_PAYMENT"))
        .map((b) => b.id),
      ...bookingSlots
        .filter((bs) => bs?.booking && (bs.booking.bookingStatus === "PENDING" || bs.booking.bookingStatus === "PENDING_PAYMENT"))
        .map((bs) => bs.bookingId)
    ].filter((id): id is string => Boolean(id));
    const paymentMap = await fetchPendingPayments([...new Set(pendingBookingIds)]);

    function applyToMatchingSlots(
      dateKey: string,
      startKey: string,
      endKey: string,
      mutator: (slot: InternalWeeklySlot) => void
    ) {
      for (const s of slotShape.slots) {
        if (s.date !== dateKey) continue;
        if (overlaps(s.startTime, s.endTime, startKey, endKey)) {
          mutator(s);
        }
      }
    }

    // 1. Legacy whole-period bookings (only mark as BOOKED when still blocking).
    for (const booking of bookings) {
      const dateKey = toIsoDate(booking.bookingDate);
      const startKey = toIsoTime(booking.startTime);
      const endKey = toIsoTime(booking.endTime);
      if (!startKey || !endKey) continue;
      const blocksSlot = hasActivePayment(booking.id, booking.bookingStatus, paymentMap);
      applyToMatchingSlots(dateKey, startKey, endKey, (slot) => {
        if (blocksSlot) {
          slot.status = "BOOKED";
          slot.bookingId = booking.id;
          slot.bookingCode = booking.bookingCode ?? null;
          slot.bookingStatus = booking.bookingStatus;
        } else {
          slot.status = "AVAILABLE";
        }
      });
    }

    // 2. Granular booking slots.
    for (const bs of bookingSlots) {
      if (!bs || !bs.booking) continue;
      const dateKey = toIsoDate(bs.bookingDate);
      const startKey = toIsoTime(bs.startTime);
      const endKey = toIsoTime(bs.endTime);
      if (!startKey || !endKey) continue;
      const blocksSlot = hasActivePayment(bs.bookingId, bs.booking.bookingStatus, paymentMap);
      applyToMatchingSlots(dateKey, startKey, endKey, (slot) => {
        if (blocksSlot) {
          slot.status = "BOOKED";
          slot.bookingId = bs.bookingId;
          slot.bookingCode = null;
          slot.bookingStatus = bs.booking.bookingStatus;
        } else if (slot.status === "AVAILABLE") {
          // Leave price/demand intact.
        }
      });
    }

    // 3. Availability blocks override everything except OUTSIDE_HOURS.
    for (const block of blocks) {
      const dateKey = toIsoDate(block.blockDate);
      const startKey = toIsoTime(block.startTime);
      const endKey = toIsoTime(block.endTime);
      if (!startKey || !endKey) continue;
      const isMaintenance = (block.reason ?? "").toLowerCase().includes("maintenance");
      const status: InternalWeeklySlot["status"] = isMaintenance ? "MAINTENANCE" : "BLOCKED";
      applyToMatchingSlots(dateKey, startKey, endKey, (slot) => {
        if (slot.status !== "OUTSIDE_HOURS") {
          slot.status = status;
          slot.blockReason = block.reason ?? null;
        }
      });
    }

    // 4. Dynamic price + demand prediction for AVAILABLE slots (in-memory,
    //    uses the bundles fetched once above instead of one round-trip per
    //    slot — this is the change that keeps the Supabase pooler alive).
    for (const slot of slotShape.slots) {
      if (slot.status !== "AVAILABLE") continue;
      const price = dynamicPriceForHour(pricingBundle, slot.date, slot.startTime, slot.endTime);
      const demand = predictHour(demandBundle, slot.date, slot.startTime, slot.endTime);
      slot.basePrice = price.basePrice || slotShape.fallbackBasePrice;
      slot.finalPrice = price.finalPrice || slotShape.fallbackBasePrice;
      slot.dynamicAdjustmentAmount = price.adjustmentsAmount;
      slot.adjustments = price.adjustments;
      slot.ruleNames = price.ruleNames;
      slot.predictedOccupancyRate = demand.predictedOccupancyRate;
      slot.predictionLevel = demand.predictionLevel as
        | "LOW"
        | "MEDIUM"
        | "HIGH"
        | "VERY_HIGH"
        | null;
      slot.predictionStatus = demand.predictionStatus as
        | "INSUFFICIENT_DATA"
        | "GENERATED"
        | "FAILED";
      slot.confidenceScore = demand.confidenceScore;
    }

    // 5. Hide past dates.
    const today = new Date().toISOString().slice(0, 10);
    for (const slot of slotShape.slots) {
      if (slot.date < today) slot.status = "OUTSIDE_HOURS";
    }

    // Build per-day buckets.
    const dayMap = new Map<string, InternalWeeklySlot[]>();
    for (const slot of slotShape.slots) {
      const bucket = dayMap.get(slot.date) ?? [];
      bucket.push(slot);
      dayMap.set(slot.date, bucket);
    }
    const days: WeeklyDay[] = Array.from(dayMap.entries()).map(([date, slots]) => ({
      date,
      weekday: weekdayOf(date),
      slots: slots.map(projectSlot)
    }));

    // Build flat maintenance list (from blocks) and sort by date/time.
    const maintenance: WeeklyMaintenanceEntry[] = blocks
      .map((b) => ({
        id: b.id,
        date: toIsoDate(b.blockDate),
        startTime: toIsoTime(b.startTime),
        endTime: toIsoTime(b.endTime),
        reason: b.reason ?? null,
        isMaintenance: (b.reason ?? "").toLowerCase().includes("maintenance")
      }))
      .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));

    // Build flat dynamicPricing list (only slots that have adjustments > 0).
    const dynamicPricing: WeeklyDynamicPriceEntry[] = slotShape.slots
      .filter((s) => s.dynamicAdjustmentAmount > 0)
      .map((s) => ({
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        basePrice: s.basePrice,
        finalPrice: s.finalPrice,
        dynamicAdjustmentAmount: s.dynamicAdjustmentAmount,
        adjustments: s.adjustments,
        ruleNames: s.ruleNames
      }))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      });

    // Build flat booking list (only those that currently block).
    const bookingEntries: WeeklyBookingEntry[] = bookings
      .filter((b) => hasActivePayment(b.id, b.bookingStatus, paymentMap))
      .map((b) => ({
        id: b.id,
        bookingCode: b.bookingCode,
        date: toIsoDate(b.bookingDate),
        startTime: toIsoTime(b.startTime),
        endTime: toIsoTime(b.endTime),
        bookingStatus: b.bookingStatus,
        userFullName: null
      }));

    // Resolve active vouchers for the week, filtered by court eligibility.
    const availableVouchers: WeeklyVoucherEntry[] = [];
    try {
      const rows = await voucherRepository.listActive();
      const candidateDays = days;
      for (const row of rows) {
        // Court-restricted voucher not for this court -> skip.
        if (row.courtId && row.courtId !== courtId) continue;

        let applicableSomewhere = false;
        let bestSlot: WeeklySlotRow | null = null;
        for (const day of candidateDays) {
          for (const slot of day.slots) {
            if (slot.status !== "AVAILABLE") continue;
            const result = evaluateVoucherEligibility(row, {
              bookingDate: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              courtId,
              subtotal: slot.finalPrice
            });
            if (result.eligible) {
              applicableSomewhere = true;
              if (!bestSlot) bestSlot = slot;
              break;
            }
          }
          if (bestSlot) break;
        }
        if (applicableSomewhere || !row.applicableDays) {
          availableVouchers.push(buildVoucherEntry(row));
        }
      }
      availableVouchers.sort((a, b) => a.endDate.localeCompare(b.endDate));
    } catch {
      // If the vouchers module fails to load we still return schedule.
    }

    const response: WeeklyScheduleResponse = {
      court: {
        id: court.id,
        name: court.name,
        address: court.address ?? null,
        district: court.district ?? null,
        city: court.city ?? null,
        openingTime: court.openingTime ? toIsoTime(court.openingTime) : WEEKLY_DEFAULT_OPEN,
        closingTime: court.closingTime ? toIsoTime(court.closingTime) : WEEKLY_DEFAULT_CLOSE,
        minPrice: Number(court.minPrice ?? 0),
        imageUrl: court.images?.[0]?.imageUrl ?? null,
        category: court.category?.name ?? null
      },
      weekStart: monday,
      weekEnd: sunday,
      slotMinutes: WEEKLY_SLOT_MINUTES,
      openingTime: court.openingTime ? toIsoTime(court.openingTime) : WEEKLY_DEFAULT_OPEN,
      closingTime: court.closingTime ? toIsoTime(court.closingTime) : WEEKLY_DEFAULT_CLOSE,
      days,
      dynamicPricing,
      bookings: bookingEntries,
      maintenance,
      availableVouchers
    };

    writeCache(key, response);
    return response;
  }
};