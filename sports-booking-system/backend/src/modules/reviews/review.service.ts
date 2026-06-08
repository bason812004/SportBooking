import { BookingStatus } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { bookingRepository } from "../bookings/booking.repository.js";
import { reviewRepository } from "./review.repository.js";

export const reviewService = {
  listByCourt(courtId: string) {
    return reviewRepository.byCourt(courtId);
  },
  async create(userId: string, input: { bookingId: string; rating: number; comment?: string }) {
    const booking = await bookingRepository.findById(input.bookingId);
    if (!booking) throw new NotFoundError("Khong tim thay don dat san");
    if (booking.userId !== userId) throw new ForbiddenError();
    if (booking.bookingStatus !== BookingStatus.COMPLETED) throw new ValidationError("Chi danh gia sau khi hoan thanh dat san");
    if (await reviewRepository.existingForBooking(input.bookingId)) throw new ConflictError("Don dat san da duoc danh gia", "REVIEW_EXISTS");
    return reviewRepository.create({
      userId,
      courtId: booking.courtId,
      bookingId: input.bookingId,
      rating: input.rating,
      comment: input.comment
    });
  }
};
