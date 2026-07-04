import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { courtRepository } from "../courts/court.repository.js";
import { reviewRepository } from "./review.repository.js";

type CreateReviewBody = {
  courtId: string;
  bookingId?: string | null;
  rating: number;
  comment?: string | null;
};

export const reviewService = {
  listByCourt(courtId: string) {
    return reviewRepository.byCourt(courtId);
  },

  async create(userId: string, input: CreateReviewBody) {
    const court = await courtRepository.findPublicById(input.courtId);
    if (!court) throw new NotFoundError("Khong tim thay san hoac san chua duoc duyet");

    const [created] = await reviewRepository.create({
      userId,
      courtId: input.courtId,
      bookingId: input.bookingId || null,
      rating: input.rating,
      comment: input.comment || null
    });
    if (!created) throw new NotFoundError("Khong the tao danh gia");
    return created;
  },

  async update(id: string, userId: string, role: string, input: { rating: number; comment?: string | null }) {
    const [review] = await reviewRepository.findById(id);
    if (!review) throw new NotFoundError("Khong tim thay danh gia");

    if (review.user.id !== userId && role !== "ADMIN") {
      throw new ValidationError("Ban khong co quyen chinh sua danh gia nay");
    }

    const [updated] = await reviewRepository.update(id, input);
    if (!updated) throw new NotFoundError("Khong the cap nhat danh gia");
    return updated;
  },

  async delete(id: string, userId: string, role: string) {
    const [review] = await reviewRepository.findById(id);
    if (!review) throw new NotFoundError("Khong tim thay danh gia");

    if (review.user.id !== userId && role !== "ADMIN") {
      throw new ValidationError("Ban khong co quyen xoa danh gia nay");
    }

    await reviewRepository.delete(id);
    return { deleted: true };
  }
};
