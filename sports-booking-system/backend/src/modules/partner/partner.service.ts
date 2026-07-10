import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from "../../shared/errors/AppError.js";
import { cloudinaryService } from "../../shared/services/cloudinary.service.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { bookingStartsAt, parseLimit, parsePage, timeToDate, timeToMinutes, toDbDate } from "../../shared/utils/time.js";
import { uniqueSlug } from "../../shared/utils/slug.js";
import { commissionService } from "../commission/commission.service.js";
import { voucherService } from "../vouchers/voucher.service.js";
import { userRepository } from "../users/user.repository.js";
import { partnerRepository } from "./partner.repository.js";
import { hashPassword } from "../auth/auth.security.js";

async function getProfile(userId: string) {
  const profile = await partnerRepository.profileByUser(userId);
  if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
  return profile;
}

function dbTime(value: Date) {
  return value.toISOString().slice(11, 16);
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
    }, input.depositPercent ?? null);
  },

  async updateCourt(userId: string, courtId: string, input: any) {
    const profile = await getProfile(userId);
    const existing = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!existing) throw new NotFoundError("Khong tim thay san cua ban");
    const { depositPercent, ...courtInput } = input;
    return partnerRepository.updateCourt(courtId, {
      ...courtInput,
      slug: courtInput.name ? uniqueSlug(courtInput.name) : undefined,
      openingTime: courtInput.openingTime ? timeToDate(courtInput.openingTime) : undefined,
      closingTime: courtInput.closingTime ? timeToDate(courtInput.closingTime) : undefined,
      approvalStatus: "PENDING"
    }, depositPercent ?? null);
  },

  async deactivateCourt(userId: string, courtId: string) {
    const profile = await getProfile(userId);
    const existing = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!existing) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.updateCourt(courtId, { activeStatus: "INACTIVE" });
  },

  async updateCourtStatus(userId: string, courtId: string, activeStatus: "ACTIVE" | "INACTIVE") {
    const profile = await getProfile(userId);
    const existing = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!existing) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.updateCourt(courtId, { activeStatus });
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
    query: {
      page?: string;
      limit?: string;
      courtId?: string;
      status?: BookingStatus;
      search?: string;
      fromDate?: string;
      toDate?: string;
      sortBy?: string;
      sortOrder?: string;
    }
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
      search: query.search,
      fromDate: query.fromDate ? toDbDate(query.fromDate) : undefined,
      toDate: query.toDate ? toDbDate(query.toDate) : undefined,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async updateBookingStatus(userId: string, bookingId: string, status: BookingStatus) {
    const profile = await getProfile(userId);
    const booking = await partnerRepository.bookingByPartner(bookingId, profile.id);
    if (!booking) throw new NotFoundError("Khong tim thay don cua san ban");

    const transitions: Partial<Record<BookingStatus, BookingStatus[]>> = {
      PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      CONFIRMED: [BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.CANCELLED],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: []
    };
    if (!(transitions[booking.bookingStatus] ?? []).includes(status)) {
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
    if (!query.courtId) throw new ValidationError("Vui long chon 1 san de xem lich");
    const court = await partnerRepository.courtByPartner(query.courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    const items = await partnerRepository.calendar(profile.id, toDbDate(query.fromDate), toDbDate(query.toDate), query.courtId);
    return {
      court: { openingTime: dbTime(court.openingTime), closingTime: dbTime(court.closingTime) },
      items
    };
  },

  async courtSurfaces(userId: string, courtId: string) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.courtSurfaces(courtId);
  },

  async courtBlocks(userId: string, courtId: string) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.courtBlocks(courtId);
  },

  async createCourtBlock(
    userId: string,
    courtId: string,
    input: { courtSurfaceId?: string | null; blockDate: string; startTime: string; endTime: string; reason?: string }
  ) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) throw new ValidationError("Gio ket thuc phai sau gio bat dau");
    if (input.courtSurfaceId) {
      const surfaces = await partnerRepository.courtSurfaces(courtId);
      if (!surfaces.some((surface) => surface.id === input.courtSurfaceId)) throw new NotFoundError("San con khong thuoc cum san nay");
    }
    return partnerRepository.createCourtBlock({
      courtId,
      courtSurfaceId: input.courtSurfaceId ?? null,
      blockDate: toDbDate(input.blockDate),
      startTime: timeToDate(input.startTime),
      endTime: timeToDate(input.endTime),
      reason: input.reason
    });
  },

  async cancelCourtBlock(userId: string, courtId: string, blockId: string) {
    const profile = await getProfile(userId);
    const block = await partnerRepository.blockByCourtAndPartner(blockId, courtId, profile.id);
    if (!block) throw new NotFoundError("Khong tim thay lich nghi nay");
    return partnerRepository.cancelCourtBlock(blockId);
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

  async updateBlogComments(userId: string, id: string, allowComments: boolean) {
    await this.blogDetail(userId, id);
    const [blog] = await partnerRepository.updateBlogComments(id, userId, allowComments);
    if (!blog) throw new ValidationError("Khong the cap nhat trang thai binh luan");
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
  },

  async listRecipients(userId: string) {
    const profile = await getProfile(userId);
    return partnerRepository.listRecipients(profile.id);
  },

  async createRecipient(userId: string, input: any) {
    const profile = await getProfile(userId);
    const [localPart, domain] = profile.user.email.split("@");
    const recipientEmail = `${localPart}+${input.emailSuffix.trim().toLowerCase()}@${domain}`;

    const existing = await prisma.user.findUnique({ where: { email: recipientEmail } });
    if (existing) throw new ConflictError("Email nhân viên đã tồn tại", "EMAIL_EXISTS");

    const court = await partnerRepository.courtByPartner(input.managedCourtId, profile.id);
    if (!court) throw new ValidationError("Sân được phân công không hợp lệ hoặc không thuộc về bạn");

    const passwordHash = await hashPassword(input.password);
    const created = await partnerRepository.createRecipient(profile.id, {
      fullName: input.fullName.trim(),
      email: recipientEmail,
      passwordHash,
      phone: input.phone,
      managedCourtId: input.managedCourtId
    });

    return created;
  },

  async updateRecipient(userId: string, id: string, input: any) {
    const profile = await getProfile(userId);
    const recipient = await partnerRepository.findRecipient(id, profile.id);
    if (!recipient) throw new NotFoundError("Không tìm thấy nhân viên");

    const updateData: any = {};
    if (input.fullName) updateData.fullName = input.fullName.trim();
    if (input.phone) updateData.phone = input.phone.trim();
    if (input.password) {
      updateData.passwordHash = await hashPassword(input.password);
    }
    if (input.managedCourtId) {
      const court = await partnerRepository.courtByPartner(input.managedCourtId, profile.id);
      if (!court) throw new ValidationError("Sân được phân công không hợp lệ");
      updateData.managedCourtId = input.managedCourtId;
    }

    return partnerRepository.updateRecipient(id, profile.id, updateData);
  },

  async deleteRecipient(userId: string, id: string) {
    const profile = await getProfile(userId);
    const recipient = await partnerRepository.findRecipient(id, profile.id);
    if (!recipient) throw new NotFoundError("Không tìm thấy nhân viên");

    await partnerRepository.deleteRecipient(id, profile.id);
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
