import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export const notificationRepository = {
  create(data: Prisma.NotificationUncheckedCreateInput) {
    return prisma.notification.create({ data });
  },
  listByUser(userId: string, page: number, limit: number) {
    const where: Prisma.NotificationWhereInput = { userId };
    return prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.notification.count({ where })
    ]);
  },
  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  },
  findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  },
  markAllRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }
};
