import { z } from "zod";

export const createReportSchema = z.object({
  body: z.object({
    courtId: z.string().trim().min(1).max(40),
    reason: z.string().trim().min(3, "Nhập lý do báo cáo (ít nhất 3 ký tự)").max(160, "Lý do tối đa 160 ký tự"),
    description: z.string().trim().max(1000, "Mô tả tối đa 1000 ký tự").optional()
  })
});

const reportIdParams = z.object({ id: z.string().trim().min(1).max(40) });

export const reportThreadSchema = z.object({ params: reportIdParams });

export const reportReplySchema = z.object({
  params: reportIdParams,
  body: z.object({
    content: z.string().trim().min(1, "Nhập nội dung trả lời").max(1000, "Nội dung tối đa 1000 ký tự")
  })
});
