import { ValidationError } from "../../shared/errors/AppError.js";

/** Booking statuses that end a booking without it being played: its voucher use is given back. */
export const VOUCHER_RELEASING_STATUSES = ["CANCELLED", "REJECTED", "EXPIRED"] as const;

export const VOUCHER_DAY_KEYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

/** Fields an admin or partner sends to create a voucher (and, partially, to edit one). */
export type VoucherTermsInput = {
  code: string;
  title: string;
  description?: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount?: number | null;
  minBookingAmount?: number;
  usageLimit?: number | null;
  startDate: string;
  endDate: string;
  applicableDays?: string[] | null;
  startTime?: string | null;
  endTime?: string | null;
  holidayOnly?: boolean;
  holidayDates?: string[] | null;
  applicableStartDate?: string | null;
  applicableEndDate?: string | null;
};

/**
 * Checks the rules a single field schema cannot see and returns the values as stored: dates parsed, the code
 * upper-cased, a cap only for percentages, empty conditions turned into "no restriction".
 */
export function normalizeVoucherTerms(input: VoucherTermsInput) {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (startDate >= endDate) throw new ValidationError("Ngày bắt đầu phải trước ngày kết thúc");
  if (input.discountType === "PERCENTAGE" && input.discountValue > 100) {
    throw new ValidationError("Voucher phần trăm không được vượt quá 100%");
  }
  if (input.startTime && input.endTime && input.startTime >= input.endTime) {
    throw new ValidationError("Giờ bắt đầu phải trước giờ kết thúc");
  }
  if (input.applicableStartDate && input.applicableEndDate && input.applicableStartDate > input.applicableEndDate) {
    throw new ValidationError("Ngày chơi bắt đầu phải trước ngày chơi kết thúc");
  }
  const days = [...new Set(input.applicableDays ?? [])];
  return {
    code: input.code.trim().toUpperCase(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    discountType: input.discountType,
    discountValue: input.discountValue,
    maxDiscountAmount: input.discountType === "PERCENTAGE" ? input.maxDiscountAmount ?? null : null,
    minBookingAmount: input.minBookingAmount ?? 0,
    usageLimit: input.usageLimit ?? null,
    startDate,
    endDate,
    // All seven days is the same as no day restriction.
    applicableDays: days.length && days.length < VOUCHER_DAY_KEYS.length ? VOUCHER_DAY_KEYS.filter((day) => days.includes(day)).join(",") : null,
    startTime: input.startTime || null,
    endTime: input.endTime || null,
    holidayOnly: input.holidayOnly ?? false,
    holidayDates: input.holidayDates?.length ? [...new Set(input.holidayDates)].sort() : null,
    applicableStartDate: input.applicableStartDate ? new Date(`${input.applicableStartDate}T00:00:00+07:00`) : null,
    applicableEndDate: input.applicableEndDate ? new Date(`${input.applicableEndDate}T23:59:59+07:00`) : null
  };
}

/** What may still change once a voucher has been activated: wording, end date and how many uses it allows. */
export const RUNNING_VOUCHER_FIELDS = ["title", "description", "endDate", "usageLimit"] as const;

/**
 * Edits to a voucher that already ran (active, disabled or expired). The discount itself, the code, the court and
 * the conditions stay fixed, so bookings made under it keep matching what customers were offered.
 */
export function runningVoucherChanges(
  current: { startDate: Date | string; usedCount: number },
  input: Partial<Record<string, unknown>>,
  now = new Date()
) {
  const locked = Object.keys(input).filter((key) => input[key] !== undefined && !(RUNNING_VOUCHER_FIELDS as readonly string[]).includes(key));
  if (locked.length) {
    throw new ValidationError("Voucher đã kích hoạt chỉ sửa được tiêu đề, mô tả, ngày kết thúc và giới hạn lượt dùng");
  }
  const changes: { title?: string; description?: string | null; endDate?: Date; usageLimit?: number | null } = {};
  if (typeof input.title === "string") changes.title = input.title.trim();
  if (input.description !== undefined) changes.description = typeof input.description === "string" && input.description.trim() ? input.description.trim() : null;
  if (input.endDate !== undefined) {
    const endDate = new Date(String(input.endDate));
    if (endDate <= now) throw new ValidationError("Ngày kết thúc mới phải ở tương lai");
    if (endDate <= new Date(current.startDate)) throw new ValidationError("Ngày kết thúc phải sau ngày bắt đầu");
    changes.endDate = endDate;
  }
  if (input.usageLimit !== undefined) {
    const usageLimit = input.usageLimit === null ? null : Number(input.usageLimit);
    if (usageLimit !== null && usageLimit < current.usedCount) {
      throw new ValidationError(`Giới hạn lượt dùng không được nhỏ hơn số lượt đã dùng (${current.usedCount})`);
    }
    changes.usageLimit = usageLimit;
  }
  return changes;
}

/**
 * Why a voucher cannot be (re)activated, or null when it can. The end date is checked first, so a voucher shown as
 * expired (stored ACTIVE, end date passed) is told to be extended, which makes it run again.
 */
export function activationProblem(voucher: { status: string; endDate: Date | string; usageLimit: number | null; usedCount: number }, now = new Date()) {
  if (new Date(voucher.endDate) <= now) return "Voucher đã hết hạn, hãy gia hạn ngày kết thúc trước";
  if (voucher.status === "ACTIVE") return "Voucher đang hoạt động";
  if (!["DRAFT", "DISABLED"].includes(voucher.status)) return "Voucher không thể kích hoạt";
  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) return "Voucher đã hết lượt sử dụng";
  return null;
}
