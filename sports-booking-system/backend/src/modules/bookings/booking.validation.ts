import { z } from "zod";

const fullHourTime = z.string().regex(/^(?:[01]\d|2[0-3]):00$/, "Gio dat san phai la gio chan, vi du 06:00");

export const createBookingSchema = z.object({
  body: z.object({
    courtId: z.string().min(1),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: fullHourTime,
    endTime: fullHourTime,
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "E_WALLET"]).default("CASH"),
    voucherId: z.string().min(1).optional(),
    voucherCode: z.string().min(2).max(40).optional(),
    note: z.string().max(500).optional(),
    services: z.array(z.object({ serviceId: z.string().min(1), quantity: z.number().int().positive() })).default([])
  })
});

const bookingSlotSchema = z.object({
  startTime: fullHourTime,
  endTime: fullHourTime
});

const bookingServiceSchema = z.object({
  serviceId: z.string().min(1),
  quantity: z.number().int().positive().max(99)
});

export const bookingQuoteSchema = z.object({
  body: z.object({
    courtId: z.string().min(1),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slots: z.array(bookingSlotSchema).min(1).max(12),
    services: z.array(bookingServiceSchema).default([]),
    voucherId: z.string().min(1).optional(),
    voucherCode: z.string().min(2).max(40).optional()
  })
});

export const bookingCheckoutSchema = z.object({
  body: z.object({
    courtId: z.string().min(1),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slots: z.array(bookingSlotSchema).min(1).max(12),
    services: z.array(bookingServiceSchema).default([]),
    voucherId: z.string().min(1).optional(),
    voucherCode: z.string().min(2).max(40).optional(),
    paymentType: z.enum(["DEPOSIT", "FULL_PAYMENT"]),
    note: z.string().max(500).optional()
  })
});

export const cancelBookingSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ cancelReason: z.string().min(3).optional() })
});
