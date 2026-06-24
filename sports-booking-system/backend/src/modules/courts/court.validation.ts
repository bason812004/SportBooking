import { z } from "zod";

export const courtListSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    keyword: z.string().optional(),
    sportType: z.string().optional(),
    province: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    radiusKm: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
    rating: z.string().optional(),
    categoryId: z.string().min(1).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    sort: z.enum(["newest", "price_asc", "price_desc"]).optional()
  })
});

export const availabilitySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
});
