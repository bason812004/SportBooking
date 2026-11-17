import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export const notificationRepository = {
  create(data: Prisma.NotificationUncheckedCreateInput) {
    return prisma.notification.create({ data });
  },
  listByUser(userId: string, page: number, limit: number, unreadOnly = false) {
    const where: Prisma.NotificationWhereInput = { userId, isRead: unreadOnly ? false : undefined };
    return prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } })
    ]);
  },
  /** Reading again keeps the first read time; count is 0 only when the notification is not the user's. */
  async markRead(id: string, userId: string) {
    const marked = await prisma.notification.updateMany({ where: { id, userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    return marked.count ? marked : { count: await prisma.notification.count({ where: { id, userId } }) };
  },
  findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  },
  markAllRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
  }
};
