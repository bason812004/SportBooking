import { z } from "zod";

export const createReportSchema = z.object({
  body: z.object({
    courtId: z.string().trim().min(1).max(40),
    reason: z.string().trim().min(3, "Nhập lý do báo cáo (ít nhất 3 ký tự)").max(160, "Lý do tối đa 160 ký tự"),
    description: z.string().trim().max(1000, "Mô tả tối đa 1000 ký tự").optional()
  })
});
