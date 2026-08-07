import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
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
import { bookingRepository } from "./booking.repository.js";
import { calculateBookingQuote, canCreateBookingCheckout } from "./booking.calculations.js";
import type { CreateBookingInput } from "./booking.types.js";

function bookingCode() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `BK${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

export type SlotPayload = {
  date?: string;
  startTime: string;
  endTime: string;
};

export type DayPayload = {
  bookingDate: string;
  slots: SlotPayload[];
};

export type ServicePayload = {
  serviceId: string;
  quantity: number;
};

export type BookingQuoteInput = {
  courtId: string;
  days: DayPayload[];
  services?: ServicePayload[];
  voucherId?: string;
  voucherCode?: string;
};

export type BookingCheckoutInput = BookingQuoteInput & {
  paymentType: "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT";
  note?: string;
};

export const bookingService = {
  async quote(userId: string, input: BookingQuoteInput) {
    const court = await bookingRepository.courtWithPricing(input.courtId);
    if (!court) throw new NotFoundError("Sân không tồn tại hoặc chưa được duyệt");

    const depositPercent = await bookingRepository.courtDepositPercent(input.courtId);
    const requiresDeposit = depositPercent > 0;

    let courtSubtotal = 0;
    const daysResult = [];

    for (const day of input.days) {
      const dayType = dayTypeFor(day.bookingDate);
      let dayCourtSubtotal = 0;
      const slotsWithPrice = [];

      for (const slot of day.slots) {
        const startMin = timeToMinutes(slot.startTime);
        const endMin = timeToMinutes(slot.endTime);
        const matchingPrice = court.prices.find(
          (price) =>
            price.dayType === dayType &&
            timeToMinutes(price.startTime.toISOString().slice(11, 16)) <= startMin &&
            timeToMinutes(price.endTime.toISOString().slice(11, 16)) >= endMin
        );
        if (!matchingPrice) {
          throw new ValidationError(`Khung giờ ${slot.startTime} - ${slot.endTime} ngày ${day.bookingDate} chưa có bảng giá`);
        }
        const hours = durationHours(slot.startTime, slot.endTime);
        const slotPrice = Number(matchingPrice.price) * hours;
        dayCourtSubtotal += slotPrice;
        slotsWithPrice.push({ ...slot, price: slotPrice });
      }ô

      courtSubtotal += dayCourtSubtotal;
      daysResult.push({
        bookingDate: day.bookingDate,
        slots: slotsWithPrice,
        courtSubtotal: dayCourtSubtotal,
        subtotal: dayCourtSubtotal,
        voucherDiscountAmount: 0,
        totalAmount: dayCourtSubtotal
      });
    }

    const serviceIds = (input.services ?? []).map((s) => s.serviceId);
    const dbServices = serviceIds.length ? await bookingRepository.services(serviceIds) : [];
    if (dbServices.length !== serviceIds.length) throw new ValidationError("Dịch vụ không hợp lệ");

    const serviceLines = (input.services ?? []).map((line) => {
      const service = dbServices.find((item) => item.id === line.serviceId)!;
      const price = Number(service.price);
      return { serviceId: line.serviceId, name: service.name, quantity: line.quantity, price, total: price * line.quantity };
    });
    const servicesSubtotal = serviceLines.reduce((sum, line) => sum + line.total, 0);

    const subtotal = courtSubtotal + servicesSubtotal;
    let voucherDiscountAmount = 0;
    let voucherId = input.voucherId;

    if (input.voucherCode || input.voucherId) {
      const voucher = await prisma.voucher.findFirst({
        where: input.voucherId
          ? { id: input.voucherId }
          : { code: input.voucherCode!.toUpperCase(), status: "ACTIVE" }
      });
      if (voucher && voucher.status === "ACTIVE") {
        voucherId = voucher.id;
        const minAmount = Number(voucher.minBookingAmount ?? 0);
        if (subtotal >= minAmount) {
          const discountVal = Number(voucher.discountValue);
          const raw = voucher.discountType === "PERCENTAGE"
            ? Math.round((subtotal * discountVal) / 100)
            : discountVal;
          const maxDiscount = voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount) : Number.POSITIVE_INFINITY;
          voucherDiscountAmount = Math.min(raw, maxDiscount, subtotal);
        }
      }
    }

    const quoteResult = calculateBookingQuote(
      daysResult.flatMap((d) => d.slots),
      voucherDiscountAmount,
      servicesSubtotal,
      depositPercent
    );

    return {
      court: { id: court.id, name: court.name, address: court.address, imageUrl: court.images?.[0]?.imageUrl ?? null },
      days: daysResult,
      services: serviceLines,
      courtSubtotal,
      servicesSubtotal,
      subtotal: quoteResult.subtotal,
      voucherDiscountAmount: quoteResult.voucherDiscountAmount,
      totalAmount: quoteResult.totalAmount,
      minimumDepositAmount: quoteResult.minimumDepositAmount,
      remainingAmount: quoteResult.remainingAmount,
      depositPercent,
      requiresDeposit,
      currency: "VND" as const,
      quoteExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      voucherId
    };
  },

  async checkout(userId: string, input: BookingCheckoutInput) {
    if (!input.days || !input.days.length) {
      throw new ValidationError("Vui lòng chọn ít nhất một ngày và khung giờ đặt sân");
    }

    const quoteData = await this.quote(userId, input);
    const { totalAmount, minimumDepositAmount, depositPercent } = quoteData;

    if (!canCreateBookingCheckout({ totalAmount, paymentType: input.paymentType, depositPercent })) {
      throw new ValidationError("Phương thức thanh toán không phù hợp với yêu cầu cọc của sân");
    }

    const paymentAmount = input.paymentType === "FULL_PAYMENT"
      ? totalAmount
      : input.paymentType === "DEPOSIT"
      ? minimumDepositAmount
      : 0;

    const remainingAmount = totalAmount - paymentAmount;

    // Single day booking
    if (input.days.length === 1) {
      const day = input.days[0];
      const dayQuote = quoteData.days[0];
      const bCode = bookingCode();

      if (input.paymentType === "PAY_AT_COURT") {
        const result = await bookingRepository.createPayAtCourtCheckout({
          bookingCode: bCode,
          userId,
          courtId: input.courtId,
          bookingDate: day.bookingDate,
          slots: dayQuote.slots,
          services: quoteData.services.map((s) => ({ serviceId: s.serviceId, quantity: s.quantity, price: s.price })),
          courtSubtotal: dayQuote.courtSubtotal,
          subtotal: quoteData.subtotal,
          voucherDiscountAmount: quoteData.voucherDiscountAmount,
          totalAmount: quoteData.totalAmount,
          voucherId: quoteData.voucherId,
          note: input.note
        });

        if ("conflict" in result && result.conflict) {
          throw new ConflictError("Khung giờ này đã có người đặt.", "BOOKING_CONFLICT");
        }

        return {
          bookingId: result.booking!.id,
          bookingStatus: result.booking!.bookingStatus,
          paymentStatus: result.booking!.paymentStatus,
          paymentType: "PAY_AT_COURT" as const,
          totalAmount: result.booking!.totalPrice,
          paymentAmount: 0,
          remainingAmount: result.booking!.totalPrice
        };
      }

      // QR_TRANSFER / DEPOSIT / FULL_PAYMENT
      const extOrderId = Date.now().toString();
      const ref = `BK${extOrderId.slice(-6)}`;
      const result = await bookingRepository.createCheckout({
        bookingCode: bCode,
        userId,
        courtId: input.courtId,
        bookingDate: day.bookingDate,
        slots: dayQuote.slots,
        services: quoteData.services.map((s) => ({ serviceId: s.serviceId, quantity: s.quantity, price: s.price })),
        courtSubtotal: dayQuote.courtSubtotal,
        subtotal: quoteData.subtotal,
        voucherDiscountAmount: quoteData.voucherDiscountAmount,
        totalAmount: quoteData.totalAmount,
        depositAmount: minimumDepositAmount,
        paymentType: input.paymentType,
        paymentAmount,
        voucherId: quoteData.voucherId,
        note: input.note,
        provider: "MOCK_QR",
        externalOrderId: extOrderId,
        qrCodeUrl: null,
        qrPayload: null,
        paymentReference: ref,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      });

      if ("conflict" in result && result.conflict) {
        throw new ConflictError("Khung giờ này đã có người đặt.", "BOOKING_CONFLICT");
      }

      return {
        bookingId: result.booking!.id,
        paymentId: result.payment!.id,
        bookingStatus: result.booking!.bookingStatus,
        paymentStatus: result.payment!.paymentStatus,
        paymentType: input.paymentType,
        totalAmount: quoteData.totalAmount,
        paymentAmount,
        remainingAmount,
        qrCodeUrl: result.payment!.qrCodeUrl ?? null,
        qrPayload: result.payment!.qrPayload ?? null,
        paymentReference: result.payment!.paymentReference,
        expiresAt: result.payment!.expiresAt?.toISOString() ?? null
      };
    }

    // Multi-day booking
    const daysData = quoteData.days.map((dayQuote) => ({
      bookingCode: bookingCode(),
      bookingDate: dayQuote.bookingDate,
      slots: dayQuote.slots,
      services: quoteData.services.map((s) => ({ serviceId: s.serviceId, quantity: s.quantity, price: s.price })),
      courtSubtotal: dayQuote.courtSubtotal,
      subtotal: dayQuote.courtSubtotal,
      voucherDiscountAmount: Math.round((dayQuote.courtSubtotal / (quoteData.courtSubtotal || 1)) * quoteData.voucherDiscountAmount),
      totalAmount: Math.max(0, dayQuote.courtSubtotal - Math.round((dayQuote.courtSubtotal / (quoteData.courtSubtotal || 1)) * quoteData.voucherDiscountAmount))
    }));

    if (input.paymentType === "PAY_AT_COURT") {
      const result = await bookingRepository.createPayAtCourtOrderCheckout({
        userId,
        courtId: input.courtId,
        days: daysData,
        voucherId: quoteData.voucherId,
        note: input.note
      });

      if ("conflict" in result && result.conflict) {
        throw new ConflictError(`Khung giờ ngày ${result.conflictDate} đã có người đặt.`, "BOOKING_CONFLICT");
      }

      return {
        orderId: result.orderId,
        bookingId: result.bookings![0].id,
        bookings: result.bookings!.map((b) => ({ bookingId: b.id, bookingDate: b.bookingDate.toISOString().slice(0, 10), totalAmount: b.totalPrice })),
        bookingStatus: "CONFIRMED",
        paymentStatus: "UNPAID",
        paymentType: "PAY_AT_COURT" as const,
        totalAmount: quoteData.totalAmount,
        paymentAmount: 0,
        remainingAmount: quoteData.totalAmount,
        bookingCount: result.bookings!.length,
        isMultiBooking: true
      };
    }

    // Multi-day QR payment
    const extOrderId = Date.now().toString();
    const ref = `BO${extOrderId.slice(-6)}`;
    const result = await bookingRepository.createOrderCheckout({
      userId,
      courtId: input.courtId,
      days: daysData,
      subtotal: quoteData.subtotal,
      voucherDiscountAmount: quoteData.voucherDiscountAmount,
      totalAmount: quoteData.totalAmount,
      paymentType: input.paymentType,
      paymentAmount,
      voucherId: quoteData.voucherId,
      note: input.note,
      provider: "MOCK_QR",
      externalOrderId: extOrderId,
      qrCodeUrl: null,
      qrPayload: null,
      paymentReference: ref,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    if ("conflict" in result && result.conflict) {
      throw new ConflictError(`Khung giờ ngày ${result.conflictDate} đã có người đặt.`, "BOOKING_CONFLICT");
    }

    return {
      orderId: result.orderId,
      bookingId: result.bookings![0].id,
      paymentId: result.payment!.id,
      bookings: result.bookings!.map((b) => ({ bookingId: b.id, bookingDate: b.bookingDate.toISOString().slice(0, 10), totalAmount: b.totalPrice })),
      bookingStatus: result.bookings![0].bookingStatus,
      paymentStatus: result.payment!.status,
      paymentType: input.paymentType,
      totalAmount: quoteData.totalAmount,
      paymentAmount,
      remainingAmount,
      qrCodeUrl: result.payment!.qrCodeUrl ?? null,
      qrPayload: result.payment!.qrPayload ?? null,
      paymentReference: result.payment!.paymentReference,
      expiresAt: result.payment!.expiresAt?.toISOString() ?? null,
      bookingCount: result.bookings!.length,
      isMultiBooking: true
    };
  },

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

    return bookingRepository.createWithServices({
      bookingCode: bookingCode(),
      userId,
      courtId: input.courtId,
      bookingDate: toDbDate(input.bookingDate),
      startTime: timeToDate(input.startTime),
      endTime: timeToDate(input.endTime),
      basePrice: courtTotal,
      dynamicAdjustmentAmount: 0,
      subtotal: courtTotal + serviceTotal,
      voucherDiscountAmount: 0,
      totalPrice: courtTotal + serviceTotal,
      depositAmount: 0,
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
    const minCancelAt = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);
    if (new Date() > minCancelAt) throw new ValidationError("Chi duoc huy truoc gio bat dau it nhat 2 gio");

    return bookingRepository.cancel(bookingId, { cancelReason, refundAmount: 0, platformRetainedAmount: 0, paymentStatus: "CANCELLED" });
  }
};
