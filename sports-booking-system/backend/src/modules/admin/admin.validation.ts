import { z } from "zod";
import { categoryWriteSchema } from "../categories/category.validation.js";

export const rejectSchema = z.object({
  body: z.object({ reason: z.string().min(3) })
});

const optionalQuery = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => value === "" ? undefined : value, schema.optional());

export const userQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(160)),
    role: optionalQuery(z.enum(["USER", "PARTNER", "ADMIN"])),
    status: optionalQuery(z.enum(["ACTIVE", "LOCKED"]))
  })
});

export const partnerQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    status: optionalQuery(z.enum(["PENDING", "APPROVED", "REJECTED"]))
  })
});

export const listQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    status: optionalQuery(z.string().trim().max(50))
  })
});

export const moderationSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(1000).optional()
  })
});

export const categoryCreateSchema = categoryWriteSchema;

export const categoryUpdateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    slug: z.string().min(2).optional(),
    description: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional()
  })
});

export const commissionRateSchema = z.object({
  body: z.object({
    rate: z.number().min(0).max(100).nullable()
  })
});

export const defaultCommissionRateSchema = z.object({
  body: z.object({
    rate: z.number().min(0).max(100)
  })
});

export const commissionReportSchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()
  })
});
