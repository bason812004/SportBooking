import { z } from "zod";

const dateField = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} không hợp lệ`);

function withRangeCheck<T extends { from: string; to: string }>(schema: z.ZodType<T>) {
  return schema
    .refine((value) => value.to >= value.from, { message: "Ngày kết thúc phải sau ngày bắt đầu", path: ["to"] })
    .refine((value) => (new Date(value.to).getTime() - new Date(value.from).getTime()) / 86_400_000 <= 366, {
      message: "Khoảng thời gian tối đa 366 ngày",
      path: ["to"]
    });
}

export const reportRangeQuerySchema = z.object({
  query: withRangeCheck(z.object({ from: dateField("Ngày bắt đầu"), to: dateField("Ngày kết thúc") }))
});

export const reportExportQuerySchema = z.object({
  query: withRangeCheck(
    z.object({ from: dateField("Ngày bắt đầu"), to: dateField("Ngày kết thúc"), format: z.enum(["excel", "pdf"]) })
  )
});

export const reportCustomerParamSchema = z.object({
  params: z.object({ userId: z.string().min(1) })
});

export const reportCustomerExportQuerySchema = z.object({
  params: z.object({ userId: z.string().min(1) }),
  query: z.object({ format: z.enum(["excel", "pdf"]) })
});

export const reportBookingExportQuerySchema = z.object({
  params: z.object({ bookingId: z.string().min(1) }),
  query: z.object({ format: z.enum(["excel", "pdf"]) })
});
