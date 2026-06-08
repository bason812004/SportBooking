import { z } from "zod";

export const updateMeSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().url().optional()
  })
});
