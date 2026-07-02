import { z } from "zod";

export const createBookingSchema = z.object({
  body: z.object({
    courtId: z.string().min(1),
    courtSurfaceId: z.string().min(1).optional(),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "E_WALLET"]).default("CASH"),
    voucherId: z.string().min(1).optional(),
    voucherCode: z.string().min(2).max(40).optional(),
    note: z.string().max(500).optional(),
    services: z.array(z.object({ serviceId: z.string().min(1), quantity: z.number().int().positive() })).default([])
  })
});

const bookingSlotSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/)
});

export const bookingQuoteSchema = z.object({
  body: z.object({
    courtId: z.string().min(1),
    courtSurfaceId: z.string().min(1).optional(),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slots: z.array(bookingSlotSchema).min(1).max(12),
    voucherCode: z.string().min(2).max(40).optional()
  })
});

export const bookingCheckoutSchema = z.object({
  body: z.object({
    courtId: z.string().min(1),
    courtSurfaceId: z.string().min(1).optional(),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slots: z.array(bookingSlotSchema).min(1).max(12),
    voucherCode: z.string().min(2).max(40).optional(),
    paymentType: z.enum(["DEPOSIT", "FULL_PAYMENT"]),
    note: z.string().max(500).optional()
  })
});

export const cancelBookingSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ cancelReason: z.string().min(3).optional() })
});
