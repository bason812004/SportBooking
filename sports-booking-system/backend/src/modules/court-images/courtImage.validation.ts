import { z } from "zod";

export const imageRequestParams = z.object({ params: z.object({ id: z.string().uuid() }) });
export const imageCourtParams = z.object({ params: z.object({ id: z.string().min(1).max(20) }) });
export const imageReviewSchema = imageRequestParams.extend({
  body: z.object({ decision: z.enum(["APPROVED", "REJECTED"]), reason: z.string().trim().max(1000).optional() })
    .refine((body) => body.decision !== "REJECTED" || Boolean(body.reason), { message: "Cần nhập lý do từ chối", path: ["reason"] })
});
