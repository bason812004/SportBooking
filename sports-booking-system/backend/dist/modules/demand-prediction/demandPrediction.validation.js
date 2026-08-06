import { z } from "zod";
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
// IDs in this app are custom prefixed varchar (e.g. "c0001"), not real UUIDs.
const id = z.string().trim().min(1).max(40);
export const demandPredictionQuerySchema = z.object({
    params: z.object({ courtId: id }),
    query: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: timeSchema,
        endTime: timeSchema
    })
});
export const partnerCourtPredictionParamsSchema = z.object({
    params: z.object({ courtId: id })
});
