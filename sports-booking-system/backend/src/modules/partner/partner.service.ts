import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from "../../shared/errors/AppError.js";
import { cloudinaryService } from "../../shared/services/cloudinary.service.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { bookingStartsAt, durationHours, parseLimit, parsePage, timeToDate, timeToMinutes, toDbDate } from "../../shared/utils/time.js";
import { uniqueSlug } from "../../shared/utils/slug.js";
import { commissionService } from "../commission/commission.service.js";
import { dynamicPricingService } from "../dynamic-pricing/dynamicPricing.service.js";
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

function normalizePhone(value: string) {
  return value.trim().replace(/[^\d+]/g, "");
}

function addMinutes(time: Date, minutes: number) {
  const next = new Date(time);
  next.setUTCMinutes(next.getUTCMinutes() + minutes);
  return next;
}

function bookingCode() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `CB${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

const extendableBookingStatuses: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

async function pricingFor(courtId: string, date: string, startTime: string, endTime: string) {
  const dynamicPrice = await dynamicPricingService.calculate(courtId, { date, startTime, endTime });
  const hours = durationHours(startTime, endTime);
  const subtotal = dynamicPrice.finalPrice * hours;
  return {
    basePrice: dynamicPrice.basePrice * hours,
    dynamicAdjustmentAmount: dynamicPrice.dynamicAdjustmentAmount * hours,
    subtotal,
    totalPrice: subtotal
  };
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

  async operations(userId: string, query: { date?: string; nowTime?: string }) {
    const profile = await getProfile(userId);
    const selectedDate = query.date ?? new Date().toISOString().slice(0, 10);
    const nowTime = query.nowTime ?? new Date().toTimeString().slice(0, 5);
    const nowMinutes = timeToMinutes(nowTime);
    const courts = await partnerRepository.operationCourts(profile.id, toDbDate(selectedDate));

    const surfaces = courts.flatMap((court) =>
      court.surfaces.map((surface) => ({ surface, court }))
    );
    const activeSurfaces = surfaces.filter(({ court }) => court.activeStatus === "ACTIVE");
    const canUseSurface = async (courtId: string, courtSurfaceId: string, startTime: string, endTime: string) => {
      const conflict = await partnerRepository.findScheduleConflict(courtId, courtSurfaceId, toDbDate(selectedDate), timeToDate(startTime), timeToDate(endTime));
      return !conflict;
    };

    const items = await Promise.all(
      surfaces.map(async ({ court, surface }) => {
        const bookings = court.bookings.filter((booking) => booking.courtSurfaceId === surface.id || booking.courtSurfaceId == null).map((booking) => ({
          ...booking,
          start: dbTime(booking.startTime),
          end: dbTime(booking.endTime)
        }));
        const currentBooking = bookings.find((booking) => timeToMinutes(booking.start) <= nowMinutes && timeToMinutes(booking.end) > nowMinutes);
        const latestEnded = [...bookings]
          .filter((booking) => timeToMinutes(booking.end) <= nowMinutes)
          .sort((left, right) => timeToMinutes(right.end) - timeToMinutes(left.end))[0];
        const nextBooking = bookings.find((booking) => timeToMinutes(booking.start) >= nowMinutes);
        const referenceBooking = currentBooking ?? latestEnded;
        const isOverdue = !currentBooking && latestEnded && nowMinutes - timeToMinutes(latestEnded.end) <= 30 && !nextBooking;
        const minutesLeft = currentBooking ? timeToMinutes(currentBooking.end) - nowMinutes : null;
        const suggestedStart = referenceBooking?.end ?? nowTime;
        const suggestedEnd = addMinutes(timeToDate(suggestedStart), 60).toISOString().slice(11, 16);
        const sameCourtFree = referenceBooking ? await canUseSurface(court.id, surface.id, suggestedStart, suggestedEnd) : null;
        const alternatives = referenceBooking
          ? (
              await Promise.all(
                activeSurfaces
                  .filter((candidate) => candidate.surface.id !== surface.id)
                  .map(async (candidate) => ({
                    id: candidate.surface.id,
                    name: `${candidate.court.name} - ${candidate.surface.name}`,
                    courtId: candidate.court.id,
                    courtName: candidate.court.name,
                    surfaceId: candidate.surface.id,
                    surfaceName: candidate.surface.name,
                    categoryName: candidate.court.category.name,
                    imageUrl: candidate.surface.imageUrl ?? candidate.court.images[0]?.imageUrl ?? null,
                    available: await canUseSurface(candidate.court.id, candidate.surface.id, suggestedStart, suggestedEnd)
                  }))
              )
            )
              .filter((candidate) => candidate.available)
              .slice(0, 4)
          : [];

        let status: "AVAILABLE" | "OCCUPIED" | "ENDING_SOON" | "OVERDUE" | "RESERVED_SOON" | "INACTIVE" = "AVAILABLE";
        if (court.activeStatus === "INACTIVE") status = "INACTIVE";
        else if (isOverdue) status = "OVERDUE";
        else if (currentBooking && minutesLeft != null && minutesLeft <= 15) status = "ENDING_SOON";
        else if (currentBooking) status = "OCCUPIED";
        else if (nextBooking && timeToMinutes(nextBooking.start) - nowMinutes <= 30) status = "RESERVED_SOON";

        const serializeBooking = (booking?: typeof bookings[number]) =>
          booking
            ? {
                id: booking.id,
                bookingCode: booking.bookingCode,
                customerName: booking.user.fullName,
                customerPhone: booking.user.phone,
                startTime: booking.start,
                endTime: booking.end,
                bookingStatus: booking.bookingStatus,
                paymentStatus: booking.paymentStatus,
                totalPrice: Number(booking.totalPrice)
              }
            : null;

        return {
          court: {
            id: court.id,
            name: court.name,
            categoryName: court.category.name,
            imageUrl: surface.imageUrl ?? court.images[0]?.imageUrl ?? null,
            activeStatus: court.activeStatus,
            approvalStatus: court.approvalStatus,
            courtCount: court.courtCount
          },
          surface: {
            id: surface.id,
            code: surface.code,
            name: surface.name,
            capacity: surface.capacity,
            surface: surface.surface,
            size: surface.size,
            imageUrl: surface.imageUrl
          },
          status,
          minutesLeft,
          currentBooking: serializeBooking(currentBooking),
          latestEndedBooking: serializeBooking(isOverdue ? latestEnded : undefined),
          nextBooking: serializeBooking(nextBooking),
          canExtend: Boolean(referenceBooking && sameCourtFree),
          suggestedExtension: referenceBooking
            ? {
                bookingId: referenceBooking.id,
                startTime: suggestedStart,
                endTime: suggestedEnd,
                minutes: 60
              }
            : null,
          alternatives: alternatives.map(({ available, ...candidate }) => candidate)
        };
      })
    );

    return {
      date: selectedDate,
      nowTime,
      summary: {
        total: items.length,
        available: items.filter((item) => item.status === "AVAILABLE").length,
        occupied: items.filter((item) => item.status === "OCCUPIED").length,
        endingSoon: items.filter((item) => item.status === "ENDING_SOON").length,
        overdue: items.filter((item) => item.status === "OVERDUE").length,
        reservedSoon: items.filter((item) => item.status === "RESERVED_SOON").length
      },
      items
    };
  },

  async extendBooking(userId: string, bookingId: string, minutes: number) {
    const profile = await getProfile(userId);
    const booking = await partnerRepository.bookingByPartner(bookingId, profile.id);
    if (!booking) throw new NotFoundError("Khong tim thay don cua san ban");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chi co the gia han don dang cho xu ly hoac da xac nhan");
    }

    const date = booking.bookingDate.toISOString().slice(0, 10);
    const startTime = dbTime(booking.endTime);
    const newEndTime = addMinutes(booking.endTime, minutes);
    const endTime = dbTime(newEndTime);
    const conflict = await partnerRepository.findScheduleConflict(booking.courtId, booking.courtSurfaceId, booking.bookingDate, booking.endTime, newEndTime, booking.id);
    if (conflict) throw new ConflictError("San nay da co lich sau do. Hay chuyen khach sang san trong.", "BOOKING_EXTENSION_CONFLICT");

    const pricing = await pricingFor(booking.courtId, date, startTime, endTime);
    return partnerRepository.extendBooking(booking.id, newEndTime, pricing);
  },

  async earlyCheckInBooking(userId: string, bookingId: string) {
    const profile = await getProfile(userId);
    const booking = await partnerRepository.bookingByPartner(bookingId, profile.id);
    if (!booking) throw new NotFoundError("Khong tim thay don cua san ban");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chi co the check-in som don dang cho xu ly hoac da xac nhan");
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const date = booking.bookingDate.toISOString().slice(0, 10);
    if (date !== today) throw new ValidationError("Chi co the check-in som cho booking hom nay");

    const currentTime = now.toTimeString().slice(0, 5);
    const originalStartTime = dbTime(booking.startTime);
    const originalEndTime = dbTime(booking.endTime);
    if (timeToMinutes(currentTime) >= timeToMinutes(originalStartTime)) {
      throw new ValidationError("Booking da den gio bat dau hoac dang dien ra");
    }
    if (timeToMinutes(currentTime) >= timeToMinutes(originalEndTime)) {
      throw new ValidationError("Khung gio booking khong hop le de check-in som");
    }
    if (timeToMinutes(originalStartTime) - timeToMinutes(currentTime) > 30) {
      throw new ValidationError("Chi co the check-in som khi booking sap den gio");
    }

    const conflict = await partnerRepository.findScheduleConflict(
      booking.courtId,
      booking.courtSurfaceId,
      booking.bookingDate,
      timeToDate(currentTime),
      booking.startTime,
      booking.id
    );
    if (conflict) throw new ConflictError("San hien khong trong de check-in som", "EARLY_CHECK_IN_CONFLICT");

    const pricing = await pricingFor(booking.courtId, date, currentTime, originalStartTime);
    return partnerRepository.earlyCheckInBooking(booking.id, booking.startTime, timeToDate(currentTime), pricing);
  },

  async earlyCheckOutBooking(userId: string, bookingId: string) {
    const profile = await getProfile(userId);
    const booking = await partnerRepository.bookingByPartner(bookingId, profile.id);
    if (!booking) throw new NotFoundError("Khong tim thay don cua san ban");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chi co the check-out som don dang cho xu ly hoac da xac nhan");
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const date = booking.bookingDate.toISOString().slice(0, 10);
    if (date !== today) throw new ValidationError("Chi co the check-out som cho booking hom nay");

    const currentTime = now.toTimeString().slice(0, 5);
    const originalStartTime = dbTime(booking.startTime);
    const originalEndTime = dbTime(booking.endTime);
    if (timeToMinutes(currentTime) <= timeToMinutes(originalStartTime) || timeToMinutes(currentTime) >= timeToMinutes(originalEndTime)) {
      throw new ValidationError("Chi co the check-out som khi booking dang dien ra");
    }

    const newEndTime = timeToDate(currentTime);
    const checkoutNote = `Khach check-out som luc ${currentTime}`;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          endTime: newEndTime,
          bookingStatus: BookingStatus.COMPLETED,
          note: booking.note ? `${booking.note}\n${checkoutNote}` : checkoutNote
        },
        include: { court: { include: { partner: true } } }
      });

      await tx.bookingSlot.updateMany({
        where: { bookingId: booking.id, endTime: booking.endTime },
        data: { endTime: newEndTime }
      });

      await commissionService.createEarning(updated, BookingStatus.COMPLETED, tx);
      return updated;
    });
  },

  async continueBooking(userId: string, bookingId: string, targetCourtSurfaceId: string, minutes: number) {
    const profile = await getProfile(userId);
    const booking = await partnerRepository.bookingByPartner(bookingId, profile.id);
    if (!booking) throw new NotFoundError("Khong tim thay don cua san ban");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chi co the tao luot choi tiep tu don dang cho xu ly hoac da xac nhan");
    }
    const targetSurface = await partnerRepository.courtSurfaceByPartner(targetCourtSurfaceId, profile.id);
    if (!targetSurface || targetSurface.court.activeStatus !== "ACTIVE") throw new ValidationError("San chuyen den khong hop le");

    const startTimeDate = booking.endTime;
    const endTimeDate = addMinutes(startTimeDate, minutes);
    const conflict = await partnerRepository.findScheduleConflict(targetSurface.courtId, targetSurface.id, booking.bookingDate, startTimeDate, endTimeDate);
    if (conflict) throw new ConflictError("San duoc chon da co lich trong khung gio nay", "BOOKING_CONFLICT");

    const date = booking.bookingDate.toISOString().slice(0, 10);
    const startTime = dbTime(startTimeDate);
    const endTime = dbTime(endTimeDate);
    const pricing = await pricingFor(targetSurface.courtId, date, startTime, endTime);
    return partnerRepository.createContinuationBooking({
      bookingCode: bookingCode(),
      userId: booking.userId,
      courtId: targetSurface.courtId,
      courtSurfaceId: targetSurface.id,
      bookingDate: booking.bookingDate,
      startTime: startTimeDate,
      endTime: endTimeDate,
      ...pricing,
      note: `Luot choi tiep tu don ${booking.bookingCode}`
    });
  },

  async createWalkInBooking(
    userId: string,
    input: {
      courtSurfaceId: string;
      customerName: string;
      customerPhone: string;
      bookingDate: string;
      startTime: string;
      minutes: number;
      paymentMethod: "CASH" | "BANK_TRANSFER" | "E_WALLET";
      note?: string;
    }
  ) {
    const profile = await getProfile(userId);
    const targetSurface = await partnerRepository.courtSurfaceByPartner(input.courtSurfaceId, profile.id);
    if (!targetSurface || targetSurface.court.activeStatus !== "ACTIVE") throw new ValidationError("San con khong hop le");

    const endTimeDate = addMinutes(timeToDate(input.startTime), input.minutes);
    const endTime = dbTime(endTimeDate);
    if (timeToMinutes(input.startTime) >= timeToMinutes(endTime)) throw new ValidationError("Khung gio khong hop le");

    const conflict = await partnerRepository.findScheduleConflict(
      targetSurface.courtId,
      targetSurface.id,
      toDbDate(input.bookingDate),
      timeToDate(input.startTime),
      endTimeDate
    );
    if (conflict) throw new ConflictError("San con nay da co lich trong khung gio da chon", "BOOKING_CONFLICT");

    const phone = normalizePhone(input.customerPhone);
    const customer =
      (await partnerRepository.findWalkInUser(phone)) ??
      (await partnerRepository.createWalkInUser({ fullName: input.customerName.trim(), phone }));

    const pricing = await pricingFor(targetSurface.courtId, input.bookingDate, input.startTime, endTime);
    return partnerRepository.createContinuationBooking({
      bookingCode: bookingCode(),
      userId: customer.id,
      courtId: targetSurface.courtId,
      courtSurfaceId: targetSurface.id,
      bookingDate: toDbDate(input.bookingDate),
      startTime: timeToDate(input.startTime),
      endTime: endTimeDate,
      ...pricing,
      paymentMethod: input.paymentMethod,
      note: input.note || `Khach vang lai tai quay: ${input.customerName.trim()} - ${phone}`
    });
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
