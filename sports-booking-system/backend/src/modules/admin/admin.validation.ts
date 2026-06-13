import { z } from "zod";
import { categoryWriteSchema } from "../categories/category.validation.js";

export const rejectSchema = z.object({
  body: z.object({ reason: z.string().min(3) })
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
