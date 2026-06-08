import { z } from "zod";

const time = z.string().regex(/^\d{2}:\d{2}$/);

export const courtWriteSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid(),
    name: z.string().min(2),
    description: z.string().optional(),
    address: z.string().min(5),
    city: z.string().min(2),
    district: z.string().min(2),
    ward: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    openingTime: time,
    closingTime: time
  })
});

export const priceWriteSchema = z.object({
  body: z.object({
    dayType: z.enum(["WEEKDAY", "WEEKEND", "HOLIDAY"]),
    startTime: time,
    endTime: time,
    price: z.number().nonnegative(),
    note: z.string().optional()
  })
});

export const serviceWriteSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    price: z.number().nonnegative(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional()
  })
});

export const imageSchema = z.object({
  body: z.object({
    imageUrl: z.string().url().optional(),
    sortOrder: z.number().int().optional()
  })
});
