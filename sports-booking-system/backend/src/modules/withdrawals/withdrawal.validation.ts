import { z } from "zod";
import { WITHDRAWAL_SORT_FIELDS, WITHDRAWAL_STATUSES } from "./withdrawal.types.js";

const optionalQuery = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

// The bank account is not taken from the request: it is always the one saved in the partner profile.
// Whole dong and the minimum are checked in the service, which says what is wrong.
export const createWithdrawalSchema = z.object({
  body: z.object({
    amount: z.number().positive().max(999_999_999)
  })
});

export const withdrawalIdParamsSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(40) })
});

export const withdrawalQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: optionalQuery(z.enum(WITHDRAWAL_STATUSES)),
    partnerId: optionalQuery(z.string().trim().min(1).max(40)),
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

/** Confirming a manual transfer keeps the bank reference with it, so the payout can be traced to the statement. */
export const withdrawalPaidSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(40) }),
  body: z.object({ note: z.string().trim().min(3, "Nhập mã giao dịch hoặc nội dung chuyển khoản").max(1000) })
});

/** The partner is told why their withdrawal was refused, so the reason is required. */
export const withdrawalRejectSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(40) }),
  body: z.object({ note: z.string().trim().min(3, "Nhập lý do (ít nhất 3 ký tự)").max(1000) })
});
