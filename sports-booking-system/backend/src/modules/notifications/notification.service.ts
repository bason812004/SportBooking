import type { Prisma } from "@prisma/client";
import { NotFoundError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { notificationRepository } from "./notification.repository.js";

export const notificationService = {
  async create(input: {
    userId: string;
    title: string;
    content: string;
    type: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const notification = await notificationRepository.create({
      userId: input.userId,
      title: input.title,
      content: input.content,
      type: input.type,
      metadata: input.metadata
    });
    realtimeService.toUser(input.userId, realtimeEvents.notificationNew, notification);
    return notification;
  },

  async list(userId: string, query: { page?: string; limit?: string }) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await notificationRepository.listByUser(userId, page, limit);
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async markRead(userId: string, id: string) {
    const result = await notificationRepository.markRead(id, userId);
    if (!result.count) throw new NotFoundError("Khong tim thay thong bao");
    return notificationRepository.findById(id);
  },

  async markAllRead(userId: string) {
    const result = await notificationRepository.markAllRead(userId);
    return { updated: result.count };
  }
};
