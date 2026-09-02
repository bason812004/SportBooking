import { z } from "zod";

export const sendMessageSchema = z.object({
  body: z.object({
    conversationId: z.string().min(1).optional(),
    message: z.string().min(1).max(2000),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(4000)
        })
      )
      .max(20)
      .optional()
  })
});

export const confirmBookingSchema = z.object({
  body: z.object({
    pendingBookingId: z.string().min(1)
  })
});

export const getConversationSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});
