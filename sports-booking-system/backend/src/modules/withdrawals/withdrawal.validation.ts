import { z } from "zod";
import { WITHDRAWAL_STATUSES } from "./withdrawal.types.js";

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
    status: z.enum(WITHDRAWAL_STATUSES).optional(),
    partnerId: z.string().trim().min(1).max(40).optional()
  })
});

export const withdrawalActionSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(40) }),
  body: z.object({
    note: z.string().trim().max(1000).optional()
  }).optional()
});
