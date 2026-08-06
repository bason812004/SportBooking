import { z } from "zod";

export const createReportSchema = z.object({
  body: z.object({
    courtId: z.string().trim().min(1).max(40),
    reason: z.string().min(3),
    description: z.string().optional()
  })
});
