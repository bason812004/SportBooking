import { z } from "zod";

// IDs in this app are custom prefixed varchar (e.g. "pp0001"), not real UUIDs.
const id = z.string().trim().min(1).max(40);

export const debtPaymentSchema = z.object({
  params: z.object({ partnerId: id }),
  body: z.object({
    amount: z.number().positive().max(10_000_000_000),
    note: z.string().trim().max(500).optional()
  })
});
