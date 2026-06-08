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
