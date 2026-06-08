import { prisma } from "../../config/db.js";
export const adminRepository = {
    dashboard() {
        return prisma.$transaction([
            prisma.user.count(),
            prisma.partnerProfile.count(),
            prisma.court.count(),
            prisma.booking.count(),
            prisma.booking.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalPrice: true } })
        ]);
    },
    users(page, limit) {
        const where = {};
        return prisma.$transaction([
            prisma.user.findMany({
                where,
                select: { id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.user.count({ where })
        ]);
    },
    setUserStatus(id, status) {
        return prisma.user.update({
            where: { id },
            data: { status },
            select: { id: true, fullName: true, email: true, role: true, status: true }
        });
    },
    partners(page, limit) {
        const where = {};
        return prisma.$transaction([
            prisma.partnerProfile.findMany({
                where,
                include: { user: { select: { id: true, fullName: true, email: true, phone: true, status: true } } },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.partnerProfile.count({ where })
        ]);
    },
    setPartnerApproval(id, approvalStatus) {
        return prisma.partnerProfile.update({ where: { id }, data: { approvalStatus } });
    },
    pendingCourts() {
        return prisma.court.findMany({
            where: { approvalStatus: "PENDING" },
            include: { category: true, partner: { include: { user: { select: { fullName: true, email: true } } } }, images: true },
            orderBy: { createdAt: "desc" }
        });
    },
    setCourtApproval(id, approvalStatus, rejectionReason) {
        return prisma.court.update({ where: { id }, data: { approvalStatus, rejectionReason } });
    },
    categories() {
        return prisma.courtCategory.findMany({ orderBy: { createdAt: "desc" } });
    },
    createCategory(data) {
        return prisma.courtCategory.create({ data });
    },
    updateCategory(id, data) {
        return prisma.courtCategory.update({ where: { id }, data });
    },
    deleteCategory(id) {
        return prisma.courtCategory.update({ where: { id }, data: { status: "INACTIVE" } });
    },
    reviews() {
        return prisma.review.findMany({
            include: { user: { select: { fullName: true, email: true } }, court: { select: { name: true } } },
            orderBy: { createdAt: "desc" }
        });
    },
    setReviewDisplay(id, displayStatus) {
        return prisma.review.update({ where: { id }, data: { displayStatus } });
    },
    deleteReview(id) {
        return prisma.review.delete({ where: { id } });
    },
    reports() {
        return prisma.report.findMany({
            include: { user: { select: { fullName: true, email: true } }, court: { select: { name: true } } },
            orderBy: { createdAt: "desc" }
        });
    },
    setReportStatus(id, status) {
        return prisma.report.update({ where: { id }, data: { status, resolvedAt: new Date() } });
    },
    statistics() {
        return prisma.$transaction([
            prisma.booking.groupBy({ by: ["bookingStatus"], orderBy: { bookingStatus: "asc" }, _count: true, _sum: { totalPrice: true } }),
            prisma.court.groupBy({ by: ["city"], orderBy: { city: "asc" }, _count: true }),
            prisma.review.aggregate({ _avg: { rating: true }, _count: true })
        ]);
    }
};
