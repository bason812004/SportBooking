import { z } from "zod";
export const createReportSchema = z.object({
    body: z.object({
        courtId: z.string().uuid(),
        reason: z.string().min(3),
        description: z.string().optional()
    })
});
