import { z } from "zod";

export const notificationIdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const notificationListSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    // "true" lists only what is still unread (the inbox page's tab).
    unread: z.enum(["true", "false"]).optional()
  })
});
