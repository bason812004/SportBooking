import { NotFoundError } from "../../shared/errors/AppError.js";
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
  }
};
