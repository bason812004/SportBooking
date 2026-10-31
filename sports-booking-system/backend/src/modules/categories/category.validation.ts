import { z } from "zod";

export const categoryWriteSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Ten danh muc can it nhat 2 ky tu").max(100, "Ten danh muc toi da 100 ky tu"),
    slug: z.string().min(2).optional(),
    description: z.string().trim().max(500, "Mo ta toi da 500 ky tu").optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional()
  })
});
