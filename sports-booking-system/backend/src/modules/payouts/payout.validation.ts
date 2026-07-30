import { z } from "zod";

export const payoutWebhookSchema = z.object({
  params: z.object({ provider: z.string().trim().min(1).max(30) }),
  body: z.record(z.unknown())
});
