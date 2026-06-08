import { z } from "zod";

export const createBookingSchema = z.object({
  body: z.object({
    courtId: z.string().uuid(),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "E_WALLET", "MOCK_PAYMENT"]),
    services: z.array(z.object({ serviceId: z.string().uuid(), quantity: z.number().int().positive() })).default([])
  })
});

export const cancelBookingSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ cancelReason: z.string().min(3).optional() })
});
