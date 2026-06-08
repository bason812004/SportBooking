import { prisma } from "../../config/db.js";
export const reviewRepository = {
    byCourt(courtId) {
        return prisma.review.findMany({
            where: { courtId, displayStatus: "VISIBLE" },
            include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
            orderBy: { createdAt: "desc" }
        });
    },
    existingForBooking(bookingId) {
        return prisma.review.findUnique({ where: { bookingId } });
    },
    create(data) {
        return prisma.review.create({ data });
    }
};
