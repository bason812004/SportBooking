import { BookingStatus } from "@prisma/client";
import { z } from "zod";

const bookingStatuses = new Set<string>(Object.values(BookingStatus));

export const myBookingsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    // Comma-separated, e.g. "CANCELLED,REJECTED,EXPIRED".
    status: z
      .string()
      .optional()
      .refine(
        (value) => !value || value.split(",").every((item) => bookingStatuses.has(item.trim())),
        "Trang thai don dat san khong hop le"
      )
  })
});

export const updateMeSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().url().optional()
  })
});
