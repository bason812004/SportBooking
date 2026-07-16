import { z } from "zod";

const optionalQuery = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => v === "" ? undefined : v, schema.optional());

export const createWithdrawalSchema = z.object({
  body: z.object({
    amount: z.number().positive("So tien phai lon hon 0"),
    bankName: z.string().min(2).max(120),
    bankAccountNumber: z.string().min(5).max(60),
    bankAccountName: z.string().min(2).max(160)
  })
});

export const withdrawalQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    partnerId: optionalQuery(z.string()),
    status: optionalQuery(z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]))
  })
});

export const withdrawalActionSchema = z.object({
  body: z.object({
    note: z.string().max(500).optional()
  })
});
