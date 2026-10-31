import { prisma } from "../../config/db.js";

export const reportRepository = {
  create(data: { userId: string; courtId: string; reason: string; description?: string }) {
    return prisma.report.create({ data });
  },

  pendingByUser(userId: string, courtId: string) {
    return prisma.report.findFirst({ where: { userId, courtId, status: "PENDING" }, select: { id: true } });
  }
};
