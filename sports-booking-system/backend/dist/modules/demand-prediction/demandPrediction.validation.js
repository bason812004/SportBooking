import { z } from "zod";
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
export const demandPredictionQuerySchema = z.object({
    params: z.object({ courtId: z.string().uuid() }),
    query: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: timeSchema,
        endTime: timeSchema
    })
});
export const partnerCourtPredictionParamsSchema = z.object({
    params: z.object({ courtId: z.string().uuid() })
});
