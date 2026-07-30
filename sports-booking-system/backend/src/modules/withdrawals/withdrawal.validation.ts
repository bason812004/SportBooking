import { z } from "zod";
import { WITHDRAWAL_SORT_FIELDS, WITHDRAWAL_STATUSES } from "./withdrawal.types.js";

const optionalQuery = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

export const createWithdrawalSchema = z.object({
  body: z.object({
    amount: z.number().positive().max(999_999_999),
    bankName: z.string().trim().min(1).max(120).optional(),
    bankAccountNumber: z.string().trim().min(1).max(60).optional(),
    bankAccountName: z.string().trim().min(1).max(160).optional()
  })
});

export const withdrawalQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: optionalQuery(z.enum(WITHDRAWAL_STATUSES)),
    partnerId: z.string().trim().min(1).max(40).optional(),
    sortBy: optionalQuery(z.enum(WITHDRAWAL_SORT_FIELDS)),
    sortOrder: optionalQuery(z.enum(["asc", "desc"])),
    fromDate: optionalQuery(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    toDate: optionalQuery(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  })
});

export const withdrawalActionSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(40) }),
  body: z.object({
    note: z.string().trim().max(1000).optional(),
    forceResult: z.enum(["SUCCESS", "FAILED", "TIMEOUT", "RANDOM"]).optional()
  }).optional()
});
