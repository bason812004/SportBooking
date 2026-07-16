/**
 * Eligibility evaluation for vouchers with time/day/holiday windows.
 *
 * Pure logic — no DB access — so it can be unit-tested without a database.
 * Callers supply the voucher row (with eligibility fields) and the booking
 * context (date/time/court/subtotal). The function returns the first failed
 * condition (or null when eligible) plus the discount breakdown.
 */
import { calculateVoucherDiscount } from "../../shared/utils/businessRules.js";

export type VoucherLike = {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number | string;
  maxDiscountAmount: number | string | null;
  minBookingAmount: number | string;
  usageLimit: number | null;
  usedCount: number;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  fundedBy: "PARTNER" | "PLATFORM" | "SHARED";
  partnerFundingPercent: number | string;
  platformFundingPercent: number | string;
  applicableDays?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  holidayOnly?: boolean;
  holidayDates?: string[] | null;
  applicableStartDate?: Date | string | null;
  applicableEndDate?: Date | string | null;
};

export type EligibilityContext = {
  /** Booking date in YYYY-MM-DD (Asia/Ho_Chi_Minh convention). */
  bookingDate: string;
  /** Start time HH:mm */
  startTime: string;
  /** End time HH:mm (exclusive). */
  endTime: string;
  /** Court id used in the booking. */
  courtId: string;
  /** Subtotal after dynamic pricing (court + services). */
  subtotal: number;
  /** Holidays already resolved by the caller (YYYY-MM-DD list). */
  systemHolidays?: string[];
};

export type EligibilityReasonCode =
  | "VOUCHER_NOT_FOUND"
  | "VOUCHER_INACTIVE"
  | "VOUCHER_NOT_STARTED"
  | "VOUCHER_EXPIRED"
  | "VOUCHER_USAGE_LIMIT_REACHED"
  | "VOUCHER_MIN_BOOKING_AMOUNT"
  | "VOUCHER_APPLICABLE_START_DATE"
  | "VOUCHER_APPLICABLE_END_DATE"
  | "VOUCHER_WRONG_DAY"
  | "VOUCHER_WRONG_TIME"
  | "VOUCHER_NOT_HOLIDAY"
  | "VOUCHER_WRONG_COURT";

export type EligibilityResult =
  | { eligible: true; discountAmount: number; finalAmount: number; platformShare: number; partnerShare: number }
  | { eligible: false; code: EligibilityReasonCode; message: string };

const DAY_KEYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
type DayKey = (typeof DAY_KEYS)[number];

function dayKeyFromYmd(ymd: string): DayKey {
  // YYYY-MM-DD -> Date in UTC midnight; rely on local date for "weekday"
  // in Ho Chi Minh timezone (+07:00). We compute weekday via Intl which
  // honours the host TZ, but to stay deterministic we shift the date by
  // 07:00 so it represents the same calendar day regardless of host TZ.
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  const shifted = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const wd = shifted.getUTCDay(); // 0=Sun..6=Sat
  const map: DayKey[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return map[wd];
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  return (h ?? 0) * 60 + (m ?? 0);
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

function parseApplicableDays(raw?: string | null): Set<DayKey> | null {
  if (!raw) return null;
  const set = new Set<DayKey>();
  for (const part of raw.split(",")) {
    const upper = part.trim().toUpperCase() as DayKey;
    if (DAY_KEYS.includes(upper)) set.add(upper);
  }
  return set.size ? set : null;
}

function resolveReasons(): Record<EligibilityReasonCode, { vi: string; en: string }> {
  return {
    VOUCHER_NOT_FOUND:            { vi: "Không tìm thấy voucher.",                                    en: "Voucher not found." },
    VOUCHER_INACTIVE:             { vi: "Voucher không còn hoạt động.",                                en: "Voucher is no longer active." },
    VOUCHER_NOT_STARTED:          { vi: "Voucher chưa đến thời gian áp dụng.",                          en: "Voucher has not started yet." },
    VOUCHER_EXPIRED:              { vi: "Voucher đã hết thời gian sử dụng.",                            en: "Voucher has expired." },
    VOUCHER_USAGE_LIMIT_REACHED:  { vi: "Voucher đã hết lượt sử dụng.",                                en: "Voucher usage limit reached." },
    VOUCHER_MIN_BOOKING_AMOUNT:   { vi: "Chưa đạt giá trị đơn hàng tối thiểu.",                         en: "Booking amount below the minimum required." },
    VOUCHER_APPLICABLE_START_DATE:{ vi: "Voucher chưa đến ngày áp dụng.",                              en: "Voucher is not yet within its applicable date range." },
    VOUCHER_APPLICABLE_END_DATE:  { vi: "Voucher đã hết thời gian áp dụng.",                            en: "Voucher is outside its applicable date range." },
    VOUCHER_WRONG_DAY:            { vi: "Voucher không áp dụng cho ngày đã chọn.",                     en: "Voucher is not valid on the selected day." },
    VOUCHER_WRONG_TIME:           { vi: "Voucher không áp dụng cho khung giờ đã chọn.",                 en: "Voucher is not valid for the selected time slot." },
    VOUCHER_NOT_HOLIDAY:          { vi: "Voucher chỉ áp dụng vào các ngày lễ.",                         en: "Voucher is only valid on holidays." },
    VOUCHER_WRONG_COURT:          { vi: "Voucher không áp dụng cho sân này.",                            en: "Voucher is not valid for this court." }
  };
}

export function translateReason(code: EligibilityReasonCode, lang: "vi" | "en" = "vi"): string {
  return resolveReasons()[code][lang];
}

export function evaluateVoucherEligibility(
  voucher: VoucherLike | null | undefined,
  ctx: EligibilityContext,
  lang: "vi" | "en" = "vi"
): EligibilityResult {
  const t = resolveReasons();
  const m = (code: EligibilityReasonCode): EligibilityResult => ({ eligible: false, code, message: t[code][lang] });

  if (!voucher) return m("VOUCHER_NOT_FOUND");
  if (voucher.status !== "ACTIVE") return m("VOUCHER_INACTIVE");
  const now = new Date();
  if (new Date(voucher.startDate) > now) return m("VOUCHER_NOT_STARTED");
  if (new Date(voucher.endDate) < now) return m("VOUCHER_EXPIRED");
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) return m("VOUCHER_USAGE_LIMIT_REACHED");

  if (voucher.applicableStartDate && parseYmd(ctx.bookingDate) < new Date(voucher.applicableStartDate)) return m("VOUCHER_APPLICABLE_START_DATE");
  if (voucher.applicableEndDate && parseYmd(ctx.bookingDate) > new Date(voucher.applicableEndDate)) return m("VOUCHER_APPLICABLE_END_DATE");

  // Holiday-only voucher requires date to be a holiday
  if (voucher.holidayOnly) {
    const isHoliday = (ctx.systemHolidays ?? []).includes(ctx.bookingDate);
    const inExplicitList = (voucher.holidayDates ?? []).map((d) => d.slice(0, 10)).includes(ctx.bookingDate);
    if (!isHoliday && !inExplicitList) return m("VOUCHER_NOT_HOLIDAY");
  }

  const allowedDays = parseApplicableDays(voucher.applicableDays ?? null);
  if (allowedDays && !voucher.holidayOnly) {
    const day = dayKeyFromYmd(ctx.bookingDate);
    if (!allowedDays.has(day)) return m("VOUCHER_WRONG_DAY");
  }

  if ((voucher.startTime || voucher.endTime) && !voucher.holidayOnly) {
    const startMin = voucher.startTime ? toMinutes(voucher.startTime.slice(0, 5)) : -1;
    const endMin = voucher.endTime ? toMinutes(voucher.endTime.slice(0, 5)) : 24 * 60 + 1;
    const slotStart = toMinutes(ctx.startTime);
    const slotEnd = toMinutes(ctx.endTime);
    if (!rangesOverlap(slotStart, slotEnd, startMin, endMin)) return m("VOUCHER_WRONG_TIME");
  }

  const subtotal = ctx.subtotal;
  const minBooking = Number(voucher.minBookingAmount);
  if (subtotal < minBooking) return m("VOUCHER_MIN_BOOKING_AMOUNT");

  const discount = calculateVoucherDiscount({
    subtotal,
    discountType: voucher.discountType,
    discountValue: Number(voucher.discountValue),
    maxDiscountAmount: voucher.maxDiscountAmount == null ? null : Number(voucher.maxDiscountAmount),
    minBookingAmount: minBooking
  });
  const discountAmount = Math.round(discount.discountAmount);
  const finalAmount = Math.max(0, subtotal - discountAmount);

  const partnerPct = Number(voucher.partnerFundingPercent ?? 100);
  const platformPct = Number(voucher.platformFundingPercent ?? 0);
  const partnerShare = Math.round((discountAmount * partnerPct) / 100);
  const platformShare = discountAmount - partnerShare;

  return { eligible: true, discountAmount, finalAmount, partnerShare, platformShare };
}

export const __test__ = { dayKeyFromYmd, parseApplicableDays, rangesOverlap, toMinutes };