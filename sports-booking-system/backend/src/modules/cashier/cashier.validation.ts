import { z } from "zod";
export const addServiceSchema = z.object({ body: z.object({ serviceId: z.string().min(1).max(100), quantity: z.number().int().positive().max(999) }) });
export const returnRentalSchema = z.object({
  body: z.object({
    rentalItemId: z.string().trim().min(1).max(64),
    status: z.enum(["RETURNED", "DAMAGED", "LOST"]),
    notes: z.string().trim().max(500).optional()
  })
});
export const bookingParamsSchema = z.object({ params: z.object({ bookingId: z.string().trim().min(1).max(64) }) });
export const updateServiceSchema = z.object({ body: z.object({ quantity: z.number().int().min(0).max(999) }) });
