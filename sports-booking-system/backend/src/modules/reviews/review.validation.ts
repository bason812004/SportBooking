import { z } from "zod";

export const createReviewSchema = z.object({
  body: z.object({
    courtId: z.string().trim().min(1),
    bookingId: z.string().trim().min(1).optional().nullable(),
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional().nullable()
  })
});
