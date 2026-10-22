import { z } from "zod";

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Vui lòng nhập nội dung").max(2000)
});

export type ChatMessageFormValues = z.infer<typeof chatMessageSchema>;
