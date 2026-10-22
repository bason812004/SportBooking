import { prisma } from "../../config/db.js";
import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { courtRepository } from "../courts/court.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { reviewRepository } from "./review.repository.js";

type CreateReviewBody = {
  courtId: string;
  bookingId?: string | null;
  rating: number;
  comment?: string | null;
};

async function customerContact(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  return user?.fullName ?? "Khach hang";
}

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

    const fullName = await customerContact(userId);
    const commentPreview = input.comment && input.comment.trim() ? `: "${input.comment.trim().slice(0, 100)}"` : ".";
    await notificationService.notifyCourtStaff(input.courtId, {
      title: `Đánh giá mới - ${court.name}`,
      content: `${fullName} danh gia ${input.rating} sao${commentPreview}`,
      type: "REVIEW_CREATED",
      metadata: { reviewId: created.id, courtId: input.courtId, rating: input.rating }
    });

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
