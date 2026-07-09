import { z } from "zod";

const time = z.string().regex(/^(?:[01]\d|2[0-3]):00$/, "Gio phai la gio chan, vi du 06:00");
const optionalQuery = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => value === "" ? undefined : value, schema.optional());

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
    closingTime: time,
    depositPercent: z.coerce.number().min(0).max(49.99).optional().nullable()
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

export const imageOrderSchema = z.object({
  body: z.object({
    imageIds: z.array(z.string().uuid()).min(1).max(20)
  })
});

export const bookingQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    courtId: optionalQuery(z.string().uuid()),
    status: optionalQuery(z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"])),
    fromDate: optionalQuery(z.string().date()),
    toDate: optionalQuery(z.string().date()),
    sortBy: optionalQuery(z.enum(["bookingDate", "customerName", "totalPrice", "bookingStatus", "paymentStatus"])),
    sortOrder: optionalQuery(z.enum(["asc", "desc"]))
  })
});

export const calendarQuerySchema = z.object({
  query: z.object({
    fromDate: z.string().date(),
    toDate: z.string().date(),
    courtId: z.string().uuid().optional()
  })
});

export const profileUpdateSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30).optional(),
    avatarUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    businessName: z.string().trim().min(2).max(180),
    address: z.string().trim().min(5),
    verificationDocumentUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    bankName: z.string().trim().max(120).optional(),
    bankAccountNumber: z.string().trim().max(60).optional(),
    bankAccountHolder: z.string().trim().max(160).optional(),
    taxCode: z.string().trim().max(60).optional()
  })
});

export const blogWriteSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(220),
    excerpt: z.string().trim().max(1000).optional(),
    content: z.string().trim().min(20),
    coverImageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
    allowComments: z.boolean().default(true)
  })
});

export const blogCommentsToggleSchema = z.object({
  body: z.object({
    allowComments: z.boolean()
  })
});

export const tournamentWriteSchema = z.object({
  body: z.object({
    courtId: z.string().uuid(),
    title: z.string().trim().min(3).max(220),
    description: z.string().trim().max(5000).optional(),
    sportType: z.string().trim().min(2).max(80),
    coverImageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    registrationDeadline: z.string().datetime(),


    maxParticipants: z.number().int().positive(),
    entryFee: z.number().nonnegative(),
    prizeDescription: z.string().trim().max(2000).optional()
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

export const recipientWriteSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(120),
    emailSuffix: z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/, "Phần đuôi email chỉ được chứa chữ cái, số và dấu gạch dưới/gạch ngang"),
    password: z.string().trim().min(6),
    phone: z.string().trim().max(30).optional(),
    managedCourtId: z.string().uuid()
  })
});

export const recipientUpdateSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    password: z.string().trim().min(6).optional(),
    phone: z.string().trim().max(30).optional(),
    managedCourtId: z.string().uuid().optional()
  })
});
