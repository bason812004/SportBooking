import { prisma } from "../../config/db.js";
export const partnerRepository = {
    profileByUser(userId) {
        return prisma.partnerProfile.findUnique({ where: { userId } });
    },
    dashboard(partnerId) {
        return prisma.$transaction([
            prisma.court.count({ where: { partnerId } }),
            prisma.booking.count({ where: { court: { partnerId } } }),
            prisma.booking.aggregate({ where: { court: { partnerId }, paymentStatus: "PAID" }, _sum: { totalPrice: true } })
        ]);
    },
    listCourts(partnerId) {
        return prisma.court.findMany({
            where: { partnerId },
            include: { category: true, images: true, prices: true, services: true },
            orderBy: { createdAt: "desc" }
        });
    },
    courtByPartner(courtId, partnerId) {
        return prisma.court.findFirst({
            where: { id: courtId, partnerId },
            include: { category: true, images: true, prices: true, services: true }
        });
    },
    createCourt(data) {
        return prisma.court.create({ data, include: { category: true } });
    },
    updateCourt(id, data) {
        return prisma.court.update({ where: { id }, data, include: { category: true, images: true, prices: true, services: true } });
    },
    addImage(data) {
        return prisma.courtImage.create({ data });
    },
    addPrice(data) {
        return prisma.courtPrice.create({ data });
    },
    priceByPartner(priceId, partnerId) {
        return prisma.courtPrice.findFirst({ where: { id: priceId, court: { partnerId } } });
    },
    updatePrice(priceId, data) {
        return prisma.courtPrice.update({ where: { id: priceId }, data });
    },
    deletePrice(priceId) {
        return prisma.courtPrice.delete({ where: { id: priceId } });
    },
    addService(data) {
        return prisma.courtService.create({ data });
    },
    serviceByPartner(serviceId, partnerId) {
        return prisma.courtService.findFirst({ where: { id: serviceId, court: { partnerId } } });
    },
    updateService(serviceId, data) {
        return prisma.courtService.update({ where: { id: serviceId }, data });
    },
    deleteService(serviceId) {
        return prisma.courtService.update({ where: { id: serviceId }, data: { status: "INACTIVE" } });
    },
    bookings(partnerId, page, limit) {
        const where = { court: { partnerId } };
        return prisma.$transaction([
            prisma.booking.findMany({
                where,
                include: { user: { select: { id: true, fullName: true, email: true, phone: true } }, court: true },
                orderBy: [{ bookingDate: "desc" }, { startTime: "asc" }],
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.booking.count({ where })
        ]);
    },
    bookingByPartner(bookingId, partnerId) {
        return prisma.booking.findFirst({ where: { id: bookingId, court: { partnerId } } });
    },
    updateBookingStatus(bookingId, status) {
        return prisma.booking.update({ where: { id: bookingId }, data: { bookingStatus: status } });
    },
    revenue(partnerId) {
        return prisma.booking.groupBy({
            by: ["bookingStatus"],
            where: { court: { partnerId } },
            _sum: { totalPrice: true },
            _count: true
        });
    },
    setCourtApproval(id, approvalStatus) {
        return prisma.court.update({ where: { id }, data: { approvalStatus } });
    }
};
