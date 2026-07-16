import { z } from "zod";

const optionalQuery = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => v === "" ? undefined : v, schema.optional());

export const settlementPartnerQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional()
  })
});

export const settlementAdminQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    partnerId: optionalQuery(z.string()),
    status: optionalQuery(z.enum(["PENDING", "PROCESSING", "SETTLED", "FAILED", "CANCELLED"])),
    fromDate: optionalQuery(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    toDate: optionalQuery(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  })
});

export const settlementActionSchema = z.object({
  body: z.object({
    reason: z.string().max(500).optional()
  })
});
