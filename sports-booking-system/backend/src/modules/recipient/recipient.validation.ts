import { z } from "zod";
import { normalizeVietnamPhone } from "../../shared/utils/phone.js";

const clockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Gio khong hop le, vi du 06:30");

// Normalized so "0901 234 567" and "+84901234567" find the same customer instead of creating a second one.
const customerPhone = z
  .string()
  .trim()
  .max(30)
  .transform(normalizeVietnamPhone)
  .pipe(z.string().regex(/^0\d{9,10}$/, "So dien thoai khong hop le, vi du 0901234567"));

const walkInServicesSchema = z
  .array(
    z.object({
      serviceId: z.string().trim().min(1).max(40),
      quantity: z.number().int().positive().max(999)
    })
  )
  .max(50)
  .optional();

export const operationsQuerySchema = z.object({
  query: z.object({
    date: z.string().date().optional(),
    nowTime: clockTime.optional()
  })
});

export const bookingExtendSchema = z.object({
  body: z.object({
    minutes: z.number().int().positive().max(240),
    targetSurfaceId: z.string().uuid().optional()
  })
});

export const timeChargeQuoteSchema = z.object({
  query: z.object({
    // "15,30,60" — the extension buttons the counter shows.
    extendMinutes: z
      .preprocess(
        (value) => (typeof value === "string" ? value.split(",").filter(Boolean).map(Number) : value),
        z.array(z.number().int().positive().max(240)).max(10)
      )
      .default([15, 30, 60])
  })
});

export const extendOptionsQuerySchema = z.object({
  query: z.object({
    minutes: z.coerce.number().int().positive().max(240)
  })
});

export const courtSurfaceStatusSchema = z.object({
  body: z.object({
    status: z.enum(["ACTIVE", "INACTIVE"])
  })
});

export const surfaceAvailabilityQuerySchema = z.object({
  query: z.object({
    date: z.string().date().optional()
  })
});

export const paymentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});

export const walkInBookingSchema = z.object({
  body: z.object({
    courtSurfaceId: z.string().trim().min(1).max(40),
    customerName: z.string().trim().min(2).max(120),
    customerPhone,
    bookingDate: z.string().date(),
    startTime: clockTime,
    minutes: z.number().int().positive().max(240),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]).default("CASH"),
    paymentType: z.enum(["FULL_PAYMENT", "DEPOSIT", "PAY_AT_COURT"]).default("FULL_PAYMENT"),
    note: z.string().trim().max(500).optional(),
    services: walkInServicesSchema
  })
});

export const walkInBookingOrderSchema = z.object({
  body: z.object({
    customerName: z.string().trim().min(2).max(120),
    customerPhone,
    slots: z
      .array(
        z.object({
          courtSurfaceId: z.string().trim().min(1).max(40),
          bookingDate: z.string().date(),
          startTime: clockTime,
          minutes: z.number().int().positive().max(240)
        })
      )
      .min(2)
      .max(14),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]).default("CASH"),
    paymentType: z.enum(["FULL_PAYMENT", "DEPOSIT", "PAY_AT_COURT"]).default("FULL_PAYMENT"),
    note: z.string().trim().max(500).optional(),
    services: walkInServicesSchema
  })
});

export const lockSlotSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1).max(40)
  }),
  body: z.object({
    bookingDate: z.string().date(),
    startTime: clockTime,
    minutes: z.number().int().positive().max(240),
    reason: z.string().trim().max(200).optional()
  })
});

export const blockIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});

export const customerLookupQuerySchema = z.object({
  query: z.object({
    phone: z.string().trim().max(30).transform(normalizeVietnamPhone).pipe(z.string().min(4, "Nhap it nhat 4 so"))
  })
});

export const customerIdParamSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1).max(40)
  })
});

export const recurringWalkInBookingSchema = z.object({
  body: z.object({
    customerName: z.string().trim().min(2).max(120),
    customerPhone,
    slots: z
      .array(
        z.object({
          courtSurfaceId: z.string().trim().min(1).max(40),
          bookingDate: z.string().date(),
          startTime: clockTime,
          minutes: z.number().int().positive().max(240)
        })
      )
      .min(1)
      .max(14),
    occurrences: z.number().int().min(2).max(26),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]).default("CASH"),
    paymentType: z.enum(["FULL_PAYMENT", "DEPOSIT", "PAY_AT_COURT"]).default("FULL_PAYMENT"),
    note: z.string().trim().max(500).optional(),
    services: walkInServicesSchema
  })
});
