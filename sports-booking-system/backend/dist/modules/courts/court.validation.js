import { z } from "zod";
export const courtListSchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        q: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        categoryId: z.string().uuid().optional(),
        sort: z.enum(["newest", "price_asc", "price_desc"]).optional()
    })
});
export const availabilitySchema = z.object({
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
});
