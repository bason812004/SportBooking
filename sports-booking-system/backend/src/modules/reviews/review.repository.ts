import { prisma } from "../../config/db.js";

export const reviewRepository = {
  byCourt(courtId: string) {
    return prisma.review.findMany({
      where: { courtId, displayStatus: "VISIBLE" },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" }
    });
  },
  existingForBooking(bookingId: string) {
    return prisma.review.findUnique({ where: { bookingId } });
  },
  create(data: { userId: string; courtId: string; bookingId: string; rating: number; comment?: string }) {
    return prisma.review.create({ data });
  }
};
