import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { cloudinaryService } from "../../shared/services/cloudinary.service.js";
import { courtImageRepository } from "./courtImage.repository.js";

export const courtImageService = {
  async listForPartner(userId: string, courtId: string) {
    if (!await courtImageRepository.ownedCourt(courtId, userId)) throw new NotFoundError("Không tìm thấy sân của bạn");
    return courtImageRepository.list(courtId);
  },
  listPending() { return courtImageRepository.list(); },
  async submit(userId: string, courtId: string, input: { imageUrl?: string; sortOrder?: number; replaceImageId?: string }, file?: Express.Multer.File) {
    if (!await courtImageRepository.ownedCourt(courtId, userId)) throw new NotFoundError("Không tìm thấy sân của bạn");
    const uploaded = file ? await cloudinaryService.uploadCourtImage(file, courtId) : null;
    const imageUrl = uploaded?.imageUrl ?? input.imageUrl;
    if (!imageUrl) throw new ValidationError("Cần chọn ảnh để gửi duyệt");
    try {
      return await courtImageRepository.submit({ ...input, courtId, imageUrl, publicId: uploaded?.publicId });
    } catch (error) {
      if (uploaded?.publicId) await cloudinaryService.deleteImage(uploaded.publicId).catch(() => undefined);
      throw error;
    }
  },
  cancel(userId: string, id: string) { return courtImageRepository.cancel(id, userId); },
  review(userId: string, id: string, decision: "APPROVED" | "REJECTED", reason?: string) {
    return courtImageRepository.review(id, userId, decision, reason);
  }
};
