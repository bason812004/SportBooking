import { z } from "zod";
export const addServiceSchema = z.object({ body: z.object({ serviceId: z.string().min(1).max(100), quantity: z.number().int().positive().max(999) }) });
export const updateServiceSchema = z.object({ body: z.object({ quantity: z.number().int().min(0).max(999) }) });
