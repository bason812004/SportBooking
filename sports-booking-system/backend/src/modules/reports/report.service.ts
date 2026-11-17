import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../shared/errors/AppError.js";
import { courtRepository } from "../courts/court.repository.js";
import { reportRepository } from "./report.repository.js";

const ALREADY_REPORTED = "Bạn đã báo cáo sân này, quản trị viên đang xem xét.";

export const reportService = {
  /** One open report per customer and court (a unique index backs this when two arrive together). */
  async create(userId: string, input: { courtId: string; reason: string; description?: string }) {
    const court = await courtRepository.findPublicById(input.courtId);
    if (!court) throw new NotFoundError("Khong tim thay san");
    if (await reportRepository.pendingByUser(userId, input.courtId)) throw new ConflictError(ALREADY_REPORTED, "ALREADY_REPORTED");
    try {
      return await reportRepository.create({ ...input, description: input.description || undefined, userId });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError(ALREADY_REPORTED, "ALREADY_REPORTED");
      throw error;
    }
  }
};
