import { z } from "zod";
import { SETTLEMENT_STATUSES } from "./settlement.types.js";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export const settlementQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.enum(SETTLEMENT_STATUSES).optional(),
    partnerId: z.string().trim().min(1).max(40).optional(),
    fromDate: dateString,
    toDate: dateString
  })
});

export const settlementIdParamsSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(40) })
});
