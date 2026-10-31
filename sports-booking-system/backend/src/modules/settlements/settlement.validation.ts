import { z } from "zod";
import { SETTLEMENT_STATUSES } from "./settlement.types.js";

const optionalQuery = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
const dateString = optionalQuery(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const settlementQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: optionalQuery(z.enum(SETTLEMENT_STATUSES)),
    partnerId: optionalQuery(z.string().trim().min(1).max(40)),
    collectedBy: optionalQuery(z.enum(["PLATFORM", "PARTNER"])),
    // Booking code or partner name.
    search: optionalQuery(z.string().trim().max(120)),
    fromDate: dateString,
    toDate: dateString
  })
});

export const settlementIdParamsSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(40) })
});

/** Cancelling or taking back a settlement moves the partner's money, so the reason (sent to them) is required. */
export const settlementCancelSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(40) }),
  body: z.object({ reason: z.string().trim().min(3, "Nhập lý do (ít nhất 3 ký tự)").max(1000) })
});
