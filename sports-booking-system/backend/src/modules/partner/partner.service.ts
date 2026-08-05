import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from "../../shared/errors/AppError.js";
import { cloudinaryService } from "../../shared/services/cloudinary.service.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { bookingStartsAt, parseLimit, parsePage, timeToDate, timeToMinutes, toDbDate } from "../../shared/utils/time.js";
import { buildSlotGrid } from "../../shared/utils/slotGrid.js";
import { uniqueSlug } from "../../shared/utils/slug.js";
import { commissionService } from "../commission/commission.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { settlementService } from "../settlements/settlement.service.js";
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

const MAX_BULK_BLOCK_DAYS = 92;

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
    const courts = await partnerRepository.listCourts(profile.id);
    return courts.map(({ _count, ...court }) => ({ ...court, surfaceCount: _count.surfaces }));
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

    const where = partnerRepository.bookingWhere(profile.id, {
      courtId: query.courtId,
      status: query.status,
      search: query.search,
      fromDate: query.fromDate ? toDbDate(query.fromDate) : undefined,
      toDate: query.toDate ? toDbDate(query.toDate) : undefined
    });

    // Bookings created together as one order (multi-slot/multi-surface walk-in,
    // or a customer's multi-day booking) share a bookingOrderId and should
    // page/display as a single group, not as N separate rows. A group can't be
    // split across pages, so paginate over deduped group keys first.
    const matchingRows = await partnerRepository.bookingMatchingRows(where, query.sortBy, query.sortOrder);

    const groupKeys: string[] = [];
    const isOrderKey = new Map<string, boolean>();
    const seen = new Set<string>();
    for (const row of matchingRows) {
      const key = row.bookingOrderId ?? row.id;
      if (seen.has(key)) continue;
      seen.add(key);
      groupKeys.push(key);
      isOrderKey.set(key, Boolean(row.bookingOrderId));
    }

    const total = groupKeys.length;
    const pageKeys = groupKeys.slice((page - 1) * limit, (page - 1) * limit + limit);
    const orderIds = pageKeys.filter((key) => isOrderKey.get(key));
    const standaloneIds = pageKeys.filter((key) => !isOrderKey.get(key));

    const [orderBookings, standaloneBookings] = await Promise.all([
      partnerRepository.bookingsByOrderIds(profile.id, orderIds),
      partnerRepository.bookingsByIds(profile.id, standaloneIds)
    ]);

    const bookingsByOrderId = new Map<string, typeof orderBookings>();
    for (const booking of orderBookings) {
      const key = booking.bookingOrderId!;
      const list = bookingsByOrderId.get(key);
      if (list) list.push(booking);
      else bookingsByOrderId.set(key, [booking]);
    }
    const standaloneById = new Map(standaloneBookings.map((booking) => [booking.id, booking]));

    const items = pageKeys.map((key) =>
      isOrderKey.get(key)
        ? { orderId: key, bookings: bookingsByOrderId.get(key) ?? [] }
        : { orderId: null, bookings: [standaloneById.get(key)!] }
    );

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

    const { updated, settlement } = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
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

      let updatedSettlement = null;
      if (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) {
        await commissionService.createEarning(updatedBooking, status, tx);
        updatedSettlement = await settlementService.settleForBooking(booking.id, tx);
      } else if (status === BookingStatus.CANCELLED) {
        updatedSettlement = await settlementService.cancelForBooking(booking.id, tx);
      }
      return { updated: updatedBooking, settlement: updatedSettlement };
    });

    if (settlement) {
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
    }
    return updated;
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

  async updateCourtSurfaceStatus(userId: string, courtId: string, surfaceId: string, status: "ACTIVE" | "INACTIVE") {
    const profile = await getProfile(userId);
    const surface = await partnerRepository.courtSurfaceByPartner(surfaceId, courtId, profile.id);
    if (!surface) throw new NotFoundError("Khong tim thay san con thuoc cum san cua ban");
    return partnerRepository.updateCourtSurfaceStatus(surfaceId, status);
  },

  async updateCourtSurface(userId: string, courtId: string, surfaceId: string, input: { openingTime?: string | null; closingTime?: string | null }) {
    const profile = await getProfile(userId);
    const surface = await partnerRepository.courtSurfaceByPartner(surfaceId, courtId, profile.id);
    if (!surface) throw new NotFoundError("Khong tim thay san con thuoc cum san cua ban");
    return partnerRepository.updateCourtSurface(surfaceId, {
      openingTime: input.openingTime === undefined ? undefined : input.openingTime ? timeToDate(input.openingTime) : null,
      closingTime: input.closingTime === undefined ? undefined : input.closingTime ? timeToDate(input.closingTime) : null
    });
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

  async courtAvailabilityGrid(userId: string, courtId: string, date: string) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");

    const dbDate = toDbDate(date);
    const [bookings, bookingSlotsRaw, blocks] = await Promise.all([
      partnerRepository.courtDayBookings(courtId, dbDate),
      partnerRepository.courtDayBookingSlots(courtId, dbDate),
      partnerRepository.courtDayBlocks(courtId, dbDate)
    ]);
    const bookingSlots = bookingSlotsRaw.map((bookingSlot) => ({ ...bookingSlot, courtSurfaceId: bookingSlot.court_surface_id }));

    return (court.surfaces ?? []).map((surface) => {
      const openingTime = surface.openingTime ?? court.openingTime;
      const closingTime = surface.closingTime ?? court.closingTime;
      return {
        surfaceId: surface.id,
        surfaceName: surface.name,
        code: surface.code,
        status: surface.status,
        operatingHours: { open: dbTime(openingTime), close: dbTime(closingTime) },
        slots: buildSlotGrid({
          date,
          openingTime,
          closingTime,
          bookings,
          bookingSlots,
          blocks,
          prices: court.prices,
          courtSurfaceId: surface.id
        })
      };
    });
  },

  async createCourtBlockBulk(
    userId: string,
    courtId: string,
    input: { courtSurfaceId?: string | null; startDate: string; endDate: string; weekdays?: number[]; startTime: string; endTime: string; reason?: string }
  ) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) throw new ValidationError("Gio ket thuc phai sau gio bat dau");
    if (input.startDate > input.endDate) throw new ValidationError("Ngay bat dau phai truoc hoac bang ngay ket thuc");
    if (input.courtSurfaceId && !court.surfaces.some((surface) => surface.id === input.courtSurfaceId)) {
      throw new NotFoundError("San con khong thuoc cum san nay");
    }

    const weekdaySet = input.weekdays && input.weekdays.length ? new Set(input.weekdays) : null;
    const dates: string[] = [];
    const cursor = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = new Date(`${input.endDate}T00:00:00.000Z`);
    while (cursor <= end) {
      if (!weekdaySet || weekdaySet.has(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (dates.length > MAX_BULK_BLOCK_DAYS) throw new ValidationError(`Chi duoc chan toi da ${MAX_BULK_BLOCK_DAYS} ngay moi lan`);
    }
    if (!dates.length) throw new ValidationError("Khong co ngay nao phu hop trong khoang da chon");

    const result = await partnerRepository.createCourtBlocks(
      dates.map((blockDate) => ({
        courtId,
        courtSurfaceId: input.courtSurfaceId ?? null,
        blockDate: toDbDate(blockDate),
        startTime: timeToDate(input.startTime),
        endTime: timeToDate(input.endTime),
        reason: input.reason
      }))
    );
    return { created: result.count };
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
