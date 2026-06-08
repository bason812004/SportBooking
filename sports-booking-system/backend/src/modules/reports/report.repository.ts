import { prisma } from "../../config/db.js";

export const reportRepository = {
  create(data: { userId: string; courtId: string; reason: string; description?: string }) {
    return prisma.report.create({ data });
  }
};
