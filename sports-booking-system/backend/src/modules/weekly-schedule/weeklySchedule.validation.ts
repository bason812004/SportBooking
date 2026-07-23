import { z } from "zod";

const weekStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD")
  .optional();

export const weeklyScheduleQuerySchema = z.object({
  query: z.object({ weekStart: weekStartSchema })
});
