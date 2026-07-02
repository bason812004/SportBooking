import { z } from "zod";

export const voucherIdParamsSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

export const applyVoucherSchema = z.object({
  body: z.object({
    voucherId: z.string().uuid().optional(),
    code: z.string().min(2).max(40).optional(),
    courtId: z.string().uuid(),
    subtotal: z.number().nonnegative()
  }).refine((value) => value.voucherId || value.code, { message: "voucherId or code is required" })
});

export const validateVoucherSchema = z.object({
  body: z.object({
    voucherId: z.string().uuid().optional(),
    code: z.string().min(2).max(40).optional(),
    courtId: z.string().min(1),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    services: z
      .array(z.object({ serviceId: z.string().min(1), quantity: z.number().int().positive().max(99) }))
      .optional()
      .default([])
  }).refine((value) => value.voucherId || value.code, { message: "voucherId hoặc code là bắt buộc" })
});

const partnerVoucherBodySchema = z.object({
    courtId: z.string().uuid().optional(),
    code: z.string().min(2).max(40),
    title: z.string().min(2).max(160),
    description: z.string().optional(),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    discountValue: z.number().positive(),
    maxDiscountAmount: z.number().nonnegative().optional(),
    minBookingAmount: z.number().nonnegative().default(0),
    usageLimit: z.number().int().positive().optional(),
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
