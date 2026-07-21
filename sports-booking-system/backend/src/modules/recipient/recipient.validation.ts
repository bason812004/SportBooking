import { z } from "zod";

export const operationsQuerySchema = z.object({
  query: z.object({
    date: z.string().date().optional(),
    nowTime: z.string().regex(/^\d{2}:\d{2}$/).optional()
  })
});

export const bookingExtendSchema = z.object({
  body: z.object({
    minutes: z.number().int().positive().max(240)
  })
});

export const courtSurfaceStatusSchema = z.object({
  body: z.object({
    status: z.enum(["ACTIVE", "INACTIVE"])
  })
});

export const surfaceAvailabilityQuerySchema = z.object({
  query: z.object({
    date: z.string().date().optional()
  })
});

export const paymentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});

export const walkInBookingSchema = z.object({
  body: z.object({
    courtSurfaceId: z.string().trim().min(1).max(40),
    customerName: z.string().trim().min(2).max(120),
    customerPhone: z.string().trim().min(6).max(30),
    bookingDate: z.string().date(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    minutes: z.number().int().positive().max(240),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "E_WALLET"]),
    note: z.string().trim().max(500).optional()
  })
});

export const customerLookupQuerySchema = z.object({
  query: z.object({
    phone: z.string().trim().min(4).max(30)
  })
});

export const customerIdParamSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1).max(40)
  })
});

export const recurringWalkInBookingSchema = z.object({
  body: z.object({
    courtSurfaceId: z.string().trim().min(1).max(40),
    customerName: z.string().trim().min(2).max(120),
    customerPhone: z.string().trim().min(6).max(30),
    startDate: z.string().date(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    minutes: z.number().int().positive().max(240),
    occurrences: z.number().int().min(2).max(26),
    note: z.string().trim().max(500).optional()
  })
});
