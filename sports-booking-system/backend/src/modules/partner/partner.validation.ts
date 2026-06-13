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
    sortOrder: z.coerce.number().int().min(0).optional()
  })
});

const nullablePositiveNumber = z.union([z.number().positive(), z.null()]).optional();

export const voucherWriteSchema = z.object({
  body: z.object({
    courtId: z.union([z.string().uuid(), z.null()]).optional(),
    code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(1000).optional(),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    discountValue: z.number().positive(),
    maxDiscountAmount: z.union([z.number().nonnegative(), z.null()]).optional(),
    minBookingAmount: z.number().nonnegative().default(0),
    usageLimit: nullablePositiveNumber.refine(
      (value) => value === undefined || value === null || Number.isInteger(value),
      "Gioi han luot dung phai la so nguyen"
    ),
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  })
});
