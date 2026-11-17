import { prisma } from "../../config/db.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
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

const NOT_PLAYED = "Bạn cần hoàn thành một lượt đặt sân tại đây để đánh giá";
const ALL_REVIEWED = "Bạn đã đánh giá tất cả các lượt chơi của mình tại sân này";

/** Why the customer cannot review the court now; the booking the review would go with when they can. */
async function reviewTarget(userId: string, courtId: string, bookingId?: string | null) {
  const booking = await reviewRepository.reviewableBooking(userId, courtId, bookingId);
  if (booking) return { booking, reason: null };
  if (bookingId) return { booking: null, reason: "Chỉ đánh giá được đơn đã hoàn thành của bạn tại sân này, mỗi đơn một lần" };
  const played = await reviewRepository.completedBookingCount(userId, courtId);
  return { booking: null, reason: played ? ALL_REVIEWED : NOT_PLAYED };
}

export const reviewService = {
  listByCourt(courtId: string) {
    return reviewRepository.byCourt(courtId);
  },

  /** What the court page shows above the review form: only customers who completed a booking there may review. */
  async eligibility(userId: string, role: string, courtId: string) {
    if (role !== "USER") return { canReview: false, reason: "Chỉ khách hàng đã chơi tại sân mới đánh giá được" };
    const { booking, reason } = await reviewTarget(userId, courtId);
    return booking ? { canReview: true, reason: null, booking } : { canReview: false, reason };
  },

  async create(userId: string, input: CreateReviewBody) {
    const court = await courtRepository.findPublicById(input.courtId);
    if (!court) throw new NotFoundError("Không tìm thấy sân hoặc sân chưa được duyệt");

    const { booking, reason } = await reviewTarget(userId, input.courtId, input.bookingId);
    if (!booking) throw new ValidationError(reason ?? NOT_PLAYED);

    let created;
    try {
      [created] = await reviewRepository.create({
        userId,
        courtId: input.courtId,
        bookingId: booking.id,
        rating: input.rating,
        comment: input.comment || null
      });
    } catch (error) {
      // The same booking reviewed twice at once: the second insert hits the unique booking_id.
      const failure = error as { code?: string; meta?: { code?: string }; message?: string };
      if (failure?.code === "P2002" || failure?.meta?.code === "23505" || /23505|unique constraint/i.test(failure?.message ?? "")) {
        throw new ConflictError("Lượt chơi này đã được đánh giá", "REVIEW_EXISTS");
      }
      throw error;
    }
    if (!created) throw new NotFoundError("Không thể tạo đánh giá");

    const fullName = await customerContact(userId);
    const commentPreview = input.comment && input.comment.trim() ? `: "${input.comment.trim().slice(0, 100)}"` : ".";
    await notificationService.notifyCourtStaff(input.courtId, {
      title: `Đánh giá mới - ${court.name}`,
      content: `${fullName} đánh giá ${input.rating} sao${commentPreview}`,
      type: "REVIEW_CREATED",
      metadata: { reviewId: created.id, courtId: input.courtId, rating: input.rating }
    });

    return created;
  },

  /** Only the author edits a review; an edit never undoes an admin's decision to hide it. */
  async update(id: string, userId: string, input: { rating: number; comment?: string | null }) {
    const [review] = await reviewRepository.findById(id);
    if (!review) throw new NotFoundError("Không tìm thấy đánh giá");
    if (review.user.id !== userId) throw new ForbiddenError("Bạn không có quyền chỉnh sửa đánh giá này");

    const [updated] = await reviewRepository.update(id, input);
    if (!updated) throw new NotFoundError("Không thể cập nhật đánh giá");
    return updated;
  },

  /** Only the author deletes their review here; admins remove reviews from the moderation page, with a reason. */
  async delete(id: string, userId: string) {
    const [review] = await reviewRepository.findById(id);
    if (!review) throw new NotFoundError("Không tìm thấy đánh giá");
    if (review.user.id !== userId) throw new ForbiddenError("Bạn không có quyền xóa đánh giá này");

    await reviewRepository.delete(id);
    return { deleted: true };
  }
};
