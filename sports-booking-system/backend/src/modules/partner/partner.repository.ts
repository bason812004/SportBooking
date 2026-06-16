import type { ApprovalStatus, BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export const partnerRepository = {
  profileByUser(userId: string) {
    return prisma.partnerProfile.findUnique({ where: { userId } });
  },

  dashboard(partnerId: string) {
    return prisma.$transaction([
      prisma.court.count({ where: { partnerId } }),
      prisma.booking.count({ where: { court: { partnerId } } }),
      prisma.booking.aggregate({ where: { court: { partnerId }, paymentStatus: "PAID" }, _sum: { totalPrice: true } })
    ]);
  },

  listCourts(partnerId: string) {
    return prisma.court.findMany({
      where: { partnerId },
      include: { category: true, images: true, prices: true, services: true },
      orderBy: { createdAt: "desc" }
    });
  },

  courtByPartner(courtId: string, partnerId: string) {
    return prisma.court.findFirst({
      where: { id: courtId, partnerId },
      include: { category: true, images: true, prices: true, services: true }
    });
  },

  createCourt(data: Prisma.CourtUncheckedCreateInput) {
    return prisma.court.create({ data, include: { category: true } });
  },

  updateCourt(id: string, data: Prisma.CourtUpdateInput) {
    return prisma.court.update({ where: { id }, data, include: { category: true, images: true, prices: true, services: true } });
  },

  addImage(data: Prisma.CourtImageUncheckedCreateInput) {
    return prisma.courtImage.create({ data });
  },

  addPrice(data: Prisma.CourtPriceUncheckedCreateInput) {
    return prisma.courtPrice.create({ data });
  },

  priceByPartner(priceId: string, partnerId: string) {
    return prisma.courtPrice.findFirst({ where: { id: priceId, court: { partnerId } } });
  },

  updatePrice(priceId: string, data: Prisma.CourtPriceUpdateInput) {
    return prisma.courtPrice.update({ where: { id: priceId }, data });
  },

  deletePrice(priceId: string) {
    return prisma.courtPrice.delete({ where: { id: priceId } });
  },

  addService(data: Prisma.CourtServiceUncheckedCreateInput) {
    return prisma.courtService.create({ data });
  },

  serviceByPartner(serviceId: string, partnerId: string) {
    return prisma.courtService.findFirst({ where: { id: serviceId, court: { partnerId } } });
  },

  updateService(serviceId: string, data: Prisma.CourtServiceUpdateInput) {
    return prisma.courtService.update({ where: { id: serviceId }, data });
  },

  deleteService(serviceId: string) {
    return prisma.courtService.update({ where: { id: serviceId }, data: { status: "INACTIVE" } });
  },

  bookings(partnerId: string, page: number, limit: number) {
    const where: Prisma.BookingWhereInput = { court: { partnerId } };
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

  bookingByPartner(bookingId: string, partnerId: string) {
    return prisma.booking.findFirst({
      where: { id: bookingId, court: { partnerId } },
      include: { court: { include: { partner: true } } }
    });
  },

  updateBookingStatus(bookingId: string, status: BookingStatus) {
    return prisma.booking.update({ where: { id: bookingId }, data: { bookingStatus: status } });
  },

  revenue(partnerId: string) {
    return prisma.booking.groupBy({
      by: ["bookingStatus"],
      where: { court: { partnerId } },
      _sum: { totalPrice: true },
      _count: true
    });
  },

  setCourtApproval(id: string, approvalStatus: ApprovalStatus) {
    return prisma.court.update({ where: { id }, data: { approvalStatus } });
  }
};
