import { z } from "zod";
import { VOUCHER_DAY_KEYS } from "./voucher.terms.js";

const fullHourTime = z.string().regex(/^(?:[01]\d|2[0-3]):00$/, "Giờ đặt sân phải là giờ chẵn, ví dụ 06:00");
// IDs in this app are custom prefixed varchar (e.g. "c0001"), not real UUIDs.
const id = z.string().trim().min(1).max(40);

export const voucherIdParamsSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const applyVoucherSchema = z.object({
  body: z.object({
    voucherId: z.string().optional(),
    code: z.string().min(2).max(40).optional(),
    courtId: id,
    subtotal: z.number().nonnegative()
  }).refine((value) => value.voucherId || value.code, { message: "voucherId or code is required" })
});

export const validateVoucherSchema = z.object({
  body: z.object({
    voucherId: z.string().optional(),
    code: z.string().min(2).max(40).optional(),
    courtId: z.string().min(1),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: fullHourTime,
    endTime: fullHourTime,
    services: z
      .array(z.object({ serviceId: z.string().min(1), quantity: z.number().int().positive().max(99) }))
      .optional()
      .default([])
  }).refine((value) => value.voucherId || value.code, { message: "voucherId hoặc code là bắt buộc" })
});

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng YYYY-MM-DD");
const clockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Giờ phải có dạng HH:mm");
const nullable = <T extends z.ZodTypeAny>(schema: T) => z.union([schema, z.null()]).optional();

/** Voucher terms as admins and partners send them; rules across fields are checked in normalizeVoucherTerms. */
const voucherTermsBody = z.object({
  courtId: nullable(id),
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Mã voucher chỉ gồm chữ không dấu, số, dấu - hoặc _"),
  title: z.string().trim().min(3).max(160),
  description: nullable(z.string().trim().max(1000)),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.number().positive(),
  maxDiscountAmount: nullable(z.number().positive()),
  minBookingAmount: z.number().nonnegative().optional(),
  usageLimit: nullable(z.number().int().positive()),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  applicableDays: nullable(z.array(z.enum(VOUCHER_DAY_KEYS)).max(7)),
  startTime: nullable(clockTime),
  endTime: nullable(clockTime),
  holidayOnly: z.boolean().optional(),
  holidayDates: nullable(z.array(ymd).max(100)),
  applicableStartDate: nullable(ymd),
  applicableEndDate: nullable(ymd)
});

export const voucherWriteSchema = z.object({
  body: voucherTermsBody
});

/** A draft resends every term (the service checks they are all there); a running voucher only what may still change. */
export const voucherUpdateSchema = z.object({
  params: z.object({ id }),
  body: voucherTermsBody.partial()
});
