import { z } from "zod";

export const paymentIdSchema = z.object({
  params: z.object({ paymentId: z.string().min(1) })
});

export const paymentWebhookSchema = z.object({
  params: z.object({ provider: z.string().min(1).max(60) }),
  body: z.record(z.unknown())
});
