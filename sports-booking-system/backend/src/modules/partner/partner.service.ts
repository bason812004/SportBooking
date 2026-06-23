import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { cloudinaryService } from "../../shared/services/cloudinary.service.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { bookingStartsAt, parseLimit, parsePage, timeToDate, timeToMinutes, toDbDate } from "../../shared/utils/time.js";
import { uniqueSlug } from "../../shared/utils/slug.js";
import { commissionService } from "../commission/commission.service.js";
import { voucherService } from "../vouchers/voucher.service.js";
import { userRepository } from "../users/user.repository.js";
import { partnerRepository } from "./partner.repository.js";

async function getProfile(userId: string) {
  const profile = await partnerRepository.profileByUser(userId);
  if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
  return profile;
}

export const partnerService = {
  async dashboard(userId: string) {
    const profile = await getProfile(userId);
    const [courts, bookingsToday, revenue, pendingBookings, trendRows, courtStatuses, recentBookings, previousRevenue] =
      await partnerRepository.dashboard(profile.id);
    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return {
        date: key,
        bookings: trendRows.filter((row) => row.bookingDate.toISOString().slice(0, 10) === key).length
      };
    });
    const currentRevenue = Number(revenue._sum.netAmount ?? 0);
    const previous = Number(previousRevenue._sum.netAmount ?? 0);
    return {
      courts,
      bookingsToday,
      revenue: currentRevenue,
      pendingBookings,
      revenueGrowth: previous > 0 ? ((currentRevenue - previous) / previous) * 100 : null,
      trend,
      courtStatuses,
      recentBookings
    };
  },

  async profile(userId: string) {
    return getProfile(userId);
  },

  async updateProfile(userId: string, input: any) {
    const profile = await getProfile(userId);
    await userRepository.updateMe(userId, {
      fullName: input.fullName,
      phone: input.phone ?? "",
      avatarUrl: input.avatarUrl || undefined
    });
    await partnerRepository.updateProfile(profile.id, {
      businessName: input.businessName,
      address: input.address,
      verificationDocumentUrl: input.verificationDocumentUrl || null,
      bankName: input.bankName || null,
      bankAccountNumber: input.bankAccountNumber || null,
      bankAccountHolder: input.bankAccountHolder || null,
      taxCode: input.taxCode || null,
      approvalStatus: "PENDING"
    });
    return getProfile(userId);
  },

  async courts(userId: string) {
    const profile = await getProfile(userId);
    return partnerRepository.listCourts(profile.id);
  },

  async courtDetail(userId: string, courtId: string) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    return court;
  },

  async createCourt(userId: string, input: any) {
    const profile = await getProfile(userId);
    if (timeToMinutes(input.openingTime) >= timeToMinutes(input.closingTime)) throw new ValidationError("Gio mo cua khong hop le");
    return partnerRepository.createCourt({
      partnerId: profile.id,
      categoryId: input.categoryId,
      name: input.name,
      slug: uniqueSlug(input.name),
      description: input.description,
      address: input.address,
      city: input.city,
      district: input.district,
      ward: input.ward,
      latitude: input.latitude,
      longitude: input.longitude,
      openingTime: timeToDate(input.openingTime),
      closingTime: timeToDate(input.closingTime),
      approvalStatus: "PENDING",
      activeStatus: "ACTIVE"
    });
  },

  async updateCourt(userId: string, courtId: string, input: any) {
    const profile = await getProfile(userId);
    const existing = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!existing) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.updateCourt(courtId, {
      ...input,
      slug: input.name ? uniqueSlug(input.name) : undefined,
      openingTime: input.openingTime ? timeToDate(input.openingTime) : undefined,
      closingTime: input.closingTime ? timeToDate(input.closingTime) : undefined,
      approvalStatus: "PENDING"
    });
  },

  async deactivateCourt(userId: string, courtId: string) {
    const profile = await getProfile(userId);
    const existing = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!existing) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.updateCourt(courtId, { activeStatus: "INACTIVE" });
  },

  async addImage(userId: string, courtId: string, input: { imageUrl?: string; sortOrder?: number }, file?: Express.Multer.File) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");

    let imageUrl = input.imageUrl;
    let publicId: string | undefined;
    if (file) {
      const uploaded = await cloudinaryService.uploadCourtImage(file, courtId);
      imageUrl = uploaded.imageUrl;
      publicId = uploaded.publicId;
    }

    if (!imageUrl) throw new ValidationError("Can imageUrl hoac file anh");
    const image = await partnerRepository.addImage({
      courtId,
      imageUrl,
      publicId,
      sortOrder: input.sortOrder ?? 0
    });
    await partnerRepository.updateCourt(courtId, { approvalStatus: "PENDING" });
    return image;
  },

  async deleteImage(userId: string, imageId: string) {
    const profile = await getProfile(userId);
    const image = await partnerRepository.imageByPartner(imageId, profile.id);
    if (!image) throw new NotFoundError("Khong tim thay anh san");
    await cloudinaryService.deleteImage(image.publicId);
    await partnerRepository.deleteImage(image.id);
    await partnerRepository.updateCourt(image.courtId, { approvalStatus: "PENDING" });
    return { id: image.id };
  },

  async reorderImages(userId: string, courtId: string, imageIds: string[]) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    const ownedIds = new Set(court.images.map((image) => image.id));
    if (imageIds.some((id) => !ownedIds.has(id)) || imageIds.length !== court.images.length) {
      throw new ValidationError("Danh sach anh khong hop le");
    }
    await partnerRepository.reorderImages(courtId, imageIds);
    return partnerRepository.courtByPartner(courtId, profile.id);
  },

  async addPrice(userId: string, courtId: string, input: any) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.addPrice({
      courtId,
      dayType: input.dayType,
      startTime: timeToDate(input.startTime),
      endTime: timeToDate(input.endTime),
      price: input.price,
      note: input.note
    });
  },

  async updatePrice(userId: string, priceId: string, input: any) {
    const profile = await getProfile(userId);
    if (!(await partnerRepository.priceByPartner(priceId, profile.id))) throw new NotFoundError("Khong tim thay bang gia");
    return partnerRepository.updatePrice(priceId, {
      dayType: input.dayType,
      startTime: input.startTime ? timeToDate(input.startTime) : undefined,
      endTime: input.endTime ? timeToDate(input.endTime) : undefined,
      price: input.price,
      note: input.note
    });
  },

  async deletePrice(userId: string, priceId: string) {
    const profile = await getProfile(userId);
    if (!(await partnerRepository.priceByPartner(priceId, profile.id))) throw new NotFoundError("Khong tim thay bang gia");
    return partnerRepository.deletePrice(priceId);
  },

  async addService(userId: string, courtId: string, input: any) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.addService({ courtId, ...input, status: input.status ?? "ACTIVE" });
  },

  async updateService(userId: string, serviceId: string, input: any) {
    const profile = await getProfile(userId);
    if (!(await partnerRepository.serviceByPartner(serviceId, profile.id))) throw new NotFoundError("Khong tim thay dich vu");
    return partnerRepository.updateService(serviceId, input);
  },

  async deleteService(userId: string, serviceId: string) {
    const profile = await getProfile(userId);
    if (!(await partnerRepository.serviceByPartner(serviceId, profile.id))) throw new NotFoundError("Khong tim thay dich vu");
    return partnerRepository.deleteService(serviceId);
  },

  async bookings(
    userId: string,
    query: { page?: string; limit?: string; courtId?: string; status?: BookingStatus; fromDate?: string; toDate?: string }
  ) {
    const profile = await getProfile(userId);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      throw new ValidationError("Khoang ngay khong hop le");
    }
    const [items, total] = await partnerRepository.bookings(profile.id, page, limit, {
      courtId: query.courtId,
      status: query.status,
      fromDate: query.fromDate ? toDbDate(query.fromDate) : undefined,
      toDate: query.toDate ? toDbDate(query.toDate) : undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async updateBookingStatus(userId: string, bookingId: string, status: BookingStatus) {
    const profile = await getProfile(userId);
    const booking = await partnerRepository.bookingByPartner(bookingId, profile.id);
    if (!booking) throw new NotFoundError("Khong tim thay don cua san ban");

    const transitions: Record<BookingStatus, BookingStatus[]> = {
      PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      CONFIRMED: [BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.CANCELLED],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: []
    };
    if (!transitions[booking.bookingStatus].includes(status)) {
      throw new ValidationError("Khong the chuyen trang thai don theo thao tac nay");
    }
    if (
      (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) &&
      new Date() < bookingStartsAt(booking.bookingDate, booking.endTime)
    ) {
      throw new ValidationError("Chi co the ket thuc don sau gio dat san");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data:
          status === BookingStatus.CANCELLED
            ? {
                bookingStatus: status,
                cancelReason: "Doi tac tu choi",
                cancelledAt: new Date(),
                refundAmount: booking.paymentStatus === "PAID" ? booking.totalPrice : 0,
                platformRetainedAmount: 0,
                paymentStatus: booking.paymentStatus === "PAID" ? "REFUNDED" : booking.paymentStatus
              }
            : {
                bookingStatus: status
              },
        include: { court: { include: { partner: true } } }
      });

      if (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) {
        await commissionService.createEarning(updated, status, tx);
      }
      return updated;
    });
  },

  async revenue(userId: string, month?: string) {
    const profile = await getProfile(userId);
    return commissionService.partnerReport(profile.id, month);
  },

  async calendar(userId: string, query: { fromDate: string; toDate: string; courtId?: string }) {
    const profile = await getProfile(userId);
    if (query.fromDate > query.toDate) throw new ValidationError("Khoang ngay khong hop le");
    return partnerRepository.calendar(profile.id, toDbDate(query.fromDate), toDbDate(query.toDate), query.courtId);
  },

  async vouchers(userId: string) {
    const profile = await getProfile(userId);
    return voucherService.listForPartner(profile.id);
  },

  async voucherDetail(userId: string, voucherId: string) {
    const profile = await getProfile(userId);
    return voucherService.detailForPartner(profile.id, voucherId);
  },

  async createVoucher(userId: string, input: any) {
    const profile = await getProfile(userId);
    return voucherService.createForPartner(profile.id, input);
  },

  async updateVoucher(userId: string, voucherId: string, input: any) {
    const profile = await getProfile(userId);
    return voucherService.updateForPartner(profile.id, voucherId, input);
  },

  async activateVoucher(userId: string, voucherId: string) {
    const profile = await getProfile(userId);
    return voucherService.activateForPartner(profile.id, voucherId);
  },

  async disableVoucher(userId: string, voucherId: string) {
    const profile = await getProfile(userId);
    return voucherService.disableForPartner(profile.id, voucherId);
  },

  async deleteVoucher(userId: string, voucherId: string) {
    const profile = await getProfile(userId);
    return voucherService.deleteForPartner(profile.id, voucherId);
  },

  async blogs(userId: string) {
    await getProfile(userId);
    return partnerRepository.listBlogs(userId);
  },

  async blogDetail(userId: string, id: string) {
    await getProfile(userId);
    const [blog] = await partnerRepository.findBlog(id, userId);
    if (!blog) throw new NotFoundError("Khong tim thay bai viet cua ban");
    return blog;
  },

  async createBlog(userId: string, input: any) {
    await getProfile(userId);
    const [blog] = await partnerRepository.createBlog(userId, { ...input, slug: uniqueSlug(input.title) });
    return blog;
  },

  async updateBlog(userId: string, id: string, input: any) {
    await this.blogDetail(userId, id);
    const [blog] = await partnerRepository.updateBlog(id, userId, { ...input, slug: uniqueSlug(input.title) });
    if (!blog) throw new ValidationError("Chi co the sua bai viet nhap");
    return blog;
  },

  async submitBlog(userId: string, id: string) {
    await this.blogDetail(userId, id);
    if (!(await partnerRepository.submitBlog(id, userId))) throw new ValidationError("Chi co the gui duyet bai viet nhap");
    return this.blogDetail(userId, id);
  },

  async deleteBlog(userId: string, id: string) {
    await getProfile(userId);
    if (!(await partnerRepository.deleteBlog(id, userId))) throw new ValidationError("Chi co the xoa bai viet nhap");
    return { id };
  },

  async tournaments(userId: string) {
    const profile = await getProfile(userId);
    return partnerRepository.listTournaments(profile.id);
  },

  async tournamentDetail(userId: string, id: string) {
    const profile = await getProfile(userId);
    const [tournament] = await partnerRepository.findTournament(id, profile.id);
    if (!tournament) throw new NotFoundError("Khong tim thay giai dau cua ban");
    return tournament;
  },

  async createTournament(userId: string, input: any) {
    const profile = await getProfile(userId);
    await validateTournament(profile.id, input);
    const [created] = await partnerRepository.createTournament(profile.id, { ...input, slug: uniqueSlug(input.title) });
    return this.tournamentDetail(userId, created.id);
  },

  async updateTournament(userId: string, id: string, input: any) {
    const profile = await getProfile(userId);
    await this.tournamentDetail(userId, id);
    await validateTournament(profile.id, input);
    if (!(await partnerRepository.updateTournament(id, profile.id, { ...input, slug: uniqueSlug(input.title) }))) {
      throw new ValidationError("Chi co the sua giai dau nhap");
    }
    return this.tournamentDetail(userId, id);
  },

  async submitTournament(userId: string, id: string) {
    const profile = await getProfile(userId);
    await this.tournamentDetail(userId, id);
    if (!(await partnerRepository.submitTournament(id, profile.id))) {
      throw new ValidationError("Chi co the gui duyet giai dau nhap");
    }
    return this.tournamentDetail(userId, id);
  },

  async deleteTournament(userId: string, id: string) {
    const profile = await getProfile(userId);
    if (!(await partnerRepository.deleteTournament(id, profile.id))) {
      throw new ValidationError("Chi co the xoa giai dau nhap");
    }
    return { id };
  }
};

async function validateTournament(partnerId: string, input: any) {
  const court = await partnerRepository.courtByPartner(input.courtId, partnerId);
  if (!court) throw new ValidationError("San khong thuoc doi tac");
  const deadline = new Date(input.registrationDeadline);
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (deadline > start || start > end) throw new ValidationError("Thoi gian giai dau khong hop le");
}
