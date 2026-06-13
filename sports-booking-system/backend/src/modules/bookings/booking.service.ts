import { BookingStatus } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import {
  bookingStartsAt,
  dayTypeFor,
  durationHours,
  parseLimit,
  parsePage,
  timeToDate,
  timeToMinutes,
  toDbDate
} from "../../shared/utils/time.js";
import { courtRepository } from "../courts/court.repository.js";
import { commissionService } from "../commission/commission.service.js";
import { bookingRepository } from "./booking.repository.js";
import type { CreateBookingInput } from "./booking.types.js";

function bookingCode() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `BK${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

export const bookingService = {
  async create(userId: string, input: CreateBookingInput) {
    if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) {
      throw new ValidationError("Gio bat dau phai nho hon gio ket thuc");
    }

    const conflict = await courtRepository.findConflict(input.courtId, input.bookingDate, input.startTime, input.endTime);
    if (conflict) {
      throw new ConflictError("Khung gio nay da co nguoi dat.", "BOOKING_CONFLICT");
    }

    const court = await bookingRepository.courtWithPricing(input.courtId);
    if (!court) throw new NotFoundError("San khong ton tai hoac chua duoc duyet");

    const dayType = dayTypeFor(input.bookingDate);
    const matchingPrice = court.prices.find(
      (price) =>
        price.dayType === dayType &&
        timeToMinutes(price.startTime.toISOString().slice(11, 16)) <= timeToMinutes(input.startTime) &&
        timeToMinutes(price.endTime.toISOString().slice(11, 16)) >= timeToMinutes(input.endTime)
    );

    if (!matchingPrice) throw new ValidationError("Khung gio nay chua co bang gia");

    const serviceIds = input.services.map((service) => service.serviceId);
    const services = serviceIds.length ? await bookingRepository.services(serviceIds) : [];
    if (services.length !== serviceIds.length) throw new ValidationError("Dich vu khong hop le");

    const serviceLines = input.services.map((line) => {
      const service = services.find((item) => item.id === line.serviceId)!;
      return { serviceId: line.serviceId, quantity: line.quantity, price: Number(service.price) };
    });

    const courtTotal = Number(matchingPrice.price) * durationHours(input.startTime, input.endTime);
    const serviceTotal = serviceLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const totalPrice = courtTotal + serviceTotal;
    const depositRate = await commissionService.depositRate();

    return bookingRepository.createWithServices({
      bookingCode: bookingCode(),
      userId,
      courtId: input.courtId,
      bookingDate: toDbDate(input.bookingDate),
      startTime: timeToDate(input.startTime),
      endTime: timeToDate(input.endTime),
      totalPrice,
      depositAmount: Math.round(totalPrice * (depositRate / 100) * 100) / 100,
      paymentMethod: input.paymentMethod,
      services: serviceLines
    });
  },

  async getForUser(userId: string, bookingId: string) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError("Khong tim thay don dat san");
    if (booking.userId !== userId) throw new ForbiddenError();
    return booking;
  },

  async listForUser(userId: string, query: { page?: string; limit?: string }) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await bookingRepository.listByUser(userId, page, limit);
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async cancel(userId: string, bookingId: string, cancelReason?: string) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError("Khong tim thay don dat san");
    if (booking.userId !== userId) throw new ForbiddenError();
    const blockedStatuses: BookingStatus[] = [BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.CANCELLED];
    if (blockedStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Don nay khong the huy");
    }

    const startAt = bookingStartsAt(booking.bookingDate, booking.startTime);
    if (new Date() >= startAt) throw new ValidationError("Khong the huy sau gio bat dau");

    const hoursUntilStart = (startAt.getTime() - Date.now()) / (60 * 60 * 1000);
    const paidAmount = booking.paymentStatus === "PAID" ? Number(booking.totalPrice) : 0;
    const refundAmount = hoursUntilStart >= 24 ? paidAmount : paidAmount * 0.5;
    const platformRetainedAmount = paidAmount - refundAmount;
    const paymentStatus =
      paidAmount === 0
        ? "UNPAID"
        : refundAmount === paidAmount
          ? "REFUNDED"
          : "PARTIALLY_REFUNDED";

    return bookingRepository.cancel(bookingId, {
      cancelReason,
      refundAmount,
      platformRetainedAmount,
      paymentStatus
    });
  }
};
