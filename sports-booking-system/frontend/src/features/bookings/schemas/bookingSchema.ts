import { z } from "zod";

export const bookingSchema = z.object({
  bookingDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "E_WALLET"]),
  voucherId: z.string().min(1).optional().or(z.literal(""))
});
