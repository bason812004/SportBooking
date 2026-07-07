import { z } from "zod";

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Gio khong hop le");

export const courtSurfaceStatusSchema = z.object({
    body: z.object({
        status: z.enum(["ACTIVE", "INACTIVE"])
    })
});

export const operationsQuerySchema = z.object({
    query: z.object({
        date: z.string().date().optional(),
        nowTime: time.optional()
    })
});

export const bookingExtendSchema = z.object({
    body: z.object({
        minutes: z.number().int().min(15).max(180)
    })
});

export const walkInBookingSchema = z.object({
    body: z.object({
        courtSurfaceId: z.string().min(1),
        customerName: z.string().trim().min(2).max(120),
        customerPhone: z.string().trim().min(6).max(30),
        bookingDate: z.string().date(),
        startTime: time,
        minutes: z.number().int().min(15).max(240),
        paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "E_WALLET"]).default("CASH"),
        note: z.string().trim().max(500).optional()
    })
});
