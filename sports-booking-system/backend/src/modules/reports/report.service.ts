import { NotFoundError } from "../../shared/errors/AppError.js";
import { courtRepository } from "../courts/court.repository.js";
import { reportRepository } from "./report.repository.js";

export const reportService = {
  async create(userId: string, input: { courtId: string; reason: string; description?: string }) {
    const court = await courtRepository.findPublicById(input.courtId);
    if (!court) throw new NotFoundError("Khong tim thay san");
    return reportRepository.create({ ...input, userId });
  }
};
