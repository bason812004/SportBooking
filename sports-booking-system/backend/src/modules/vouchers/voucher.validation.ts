import { z } from "zod";

const fullHourTime = z.string().regex(/^(?:[01]\d|2[0-3]):00$/, "Gio dat san phai la gio chan, vi du 06:00");
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

const partnerVoucherBodySchema = z.object({
    courtId: id.optional().nullable(),
    code: z.string().min(2).max(40),
    title: z.string().min(2).max(160),
    description: z.string().optional(),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    discountValue: z.number().positive(),
    maxDiscountAmount: z.number().nonnegative().optional().nullable(),
    minBookingAmount: z.number().nonnegative().default(0),
    usageLimit: z.number().int().positive().optional().nullable(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    status: z.enum(["DRAFT", "ACTIVE", "EXPIRED", "DISABLED"]).default("DRAFT")
});

export const partnerVoucherWriteSchema = z.object({
  body: partnerVoucherBodySchema
});

export const partnerVoucherUpdateSchema = z.object({
  body: partnerVoucherBodySchema.partial()
});
