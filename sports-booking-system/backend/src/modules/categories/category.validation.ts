import { z } from "zod";

export const categoryWriteSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    slug: z.string().min(2).optional(),
    description: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional()
  })
});
