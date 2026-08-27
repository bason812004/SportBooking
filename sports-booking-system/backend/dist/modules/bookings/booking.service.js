import { BookingStatus } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { bookingStartsAt, dayTypeFor, durationHours, parseLimit, parsePage, timeToDate, timeToMinutes, toDbDate } from "../../shared/utils/time.js";
import { courtRepository } from "../courts/court.repository.js";
import { bookingRepository } from "./booking.repository.js";
import { canCreateBookingCheckout } from "./booking.calculations.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { invalidateWeeklyScheduleCache } from "../weekly-schedule/weeklySchedule.service.js";
function bookingCode() {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    return `BK${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}
function notifyCourtAvailabilityUpdated(courtId) {
    invalidateWeeklyScheduleCache(courtId);
    realtimeService.toCourt(courtId, "court:availability:updated", { courtId });
    realtimeService.toPublic("court:availability:updated", { courtId });
    realtimeService.toCourt(courtId, "court:availability-updated", { courtId });
    realtimeService.toPublic("court:availability-updated", { courtId });
    realtimeService.toCourt(courtId, "inventory:updated", { courtId });
    realtimeService.toPublic("inventory:updated", { courtId });
}
import { calculateBookingPrice } from "../pricing/bookingPricing.service.js";
export const bookingService = {
    async quote(userId, input) {
        const flatSlots = input.days.flatMap((day) => day.slots.map((s) => ({
            courtId: input.courtId,
            courtSurfaceId: s.courtSurfaceId || s.court_surface_id || s.courtSubId,
            date: s.date || day.bookingDate,
            startTime: s.startTime,
            endTime: s.endTime
        })));
        const calculated = await calculateBookingPrice({
            courtId: input.courtId,
            slots: flatSlots,
            services: input.services,
            voucherId: input.voucherId,
            voucherCode: input.voucherCode
        });
        const daysMap = new Map();
        for (const item of calculated.items) {
            const list = daysMap.get(item.date) || [];
            list.push({
                courtSurfaceId: item.courtSurfaceId,
                courtSurfaceName: item.courtSurfaceName,
                startTime: item.startTime,
                endTime: item.endTime,
                basePrice: item.basePrice,
                dynamicAdjustment: item.dynamicAdjustment,
                price: item.finalPrice,
                finalPrice: item.finalPrice
            });
            daysMap.set(item.date, list);
        }
        const daysResult = Array.from(daysMap.entries()).map(([bookingDate, slots]) => {
            const dayCourtSub = slots.reduce((sum, s) => sum + s.price, 0);
            return {
                bookingDate,
                slots,
                courtSubtotal: dayCourtSub,
                subtotal: dayCourtSub,
                voucherDiscountAmount: 0,
                totalAmount: dayCourtSub
            };
        });
        return {
            court: calculated.court,
            days: daysResult,
            services: calculated.services,
            courtSubtotal: calculated.courtSubtotal,
            servicesSubtotal: calculated.servicesSubtotal,
            subtotal: calculated.subtotal,
            voucherDiscountAmount: calculated.voucherDiscountAmount,
            totalAmount: calculated.totalAmount,
            minimumDepositAmount: calculated.depositAmount,
            remainingAmount: calculated.remainingAmount,
            depositPercent: calculated.depositPercent,
            requiresDeposit: calculated.requiresDeposit,
            currency: "VND",
            quoteExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            voucherId: calculated.voucherId
        };
    },
    async checkout(userId, input) {
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
                notifyCourtAvailabilityUpdated(input.courtId);
                return {
                    bookingId: result.booking.id,
                    bookingStatus: result.booking.bookingStatus,
                    paymentStatus: result.booking.paymentStatus,
                    paymentType: "PAY_AT_COURT",
                    totalAmount: result.booking.totalPrice,
                    paymentAmount: 0,
                    remainingAmount: result.booking.totalPrice
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
            notifyCourtAvailabilityUpdated(input.courtId);
            return {
                bookingId: result.booking.id,
                paymentId: result.payment.id,
                bookingStatus: result.booking.bookingStatus,
                paymentStatus: result.payment.status,
                paymentType: input.paymentType,
                totalAmount: quoteData.totalAmount,
                paymentAmount,
                remainingAmount,
                qrCodeUrl: result.payment.qrCodeUrl ?? null,
                qrPayload: result.payment.qrPayload ?? null,
                paymentReference: result.payment.paymentReference,
                expiresAt: result.payment.expiresAt?.toISOString() ?? null
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
            notifyCourtAvailabilityUpdated(input.courtId);
            return {
                orderId: result.orderId,
                bookingId: result.bookings[0].id,
                bookings: result.bookings.map((b) => ({ bookingId: b.id, bookingDate: b.bookingDate.toISOString().slice(0, 10), totalAmount: b.totalPrice })),
                bookingStatus: "CONFIRMED",
                paymentStatus: "UNPAID",
                paymentType: "PAY_AT_COURT",
                totalAmount: quoteData.totalAmount,
                paymentAmount: 0,
                remainingAmount: quoteData.totalAmount,
                bookingCount: result.bookings.length,
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
            bookingId: result.bookings[0].id,
            paymentId: result.payment.id,
            bookings: result.bookings.map((b) => ({ bookingId: b.id, bookingDate: b.bookingDate.toISOString().slice(0, 10), totalAmount: b.totalPrice })),
            bookingStatus: result.bookings[0].bookingStatus,
            paymentStatus: result.payment.status,
            paymentType: input.paymentType,
            totalAmount: quoteData.totalAmount,
            paymentAmount,
            remainingAmount,
            qrCodeUrl: result.payment.qrCodeUrl ?? null,
            qrPayload: result.payment.qrPayload ?? null,
            paymentReference: result.payment.paymentReference,
            expiresAt: result.payment.expiresAt?.toISOString() ?? null,
            bookingCount: result.bookings.length,
            isMultiBooking: true
        };
    },
    async create(userId, input) {
        if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) {
            throw new ValidationError("Gio bat dau phai nho hon gio ket thuc");
        }
        const conflict = await courtRepository.findConflict(input.courtId, input.bookingDate, input.startTime, input.endTime);
        if (conflict) {
            throw new ConflictError("Khung gio nay da co nguoi dat.", "BOOKING_CONFLICT");
        }
        const court = await bookingRepository.courtWithPricing(input.courtId);
        if (!court)
            throw new NotFoundError("San khong ton tai hoac chua duoc duyet");
        const dayType = dayTypeFor(input.bookingDate);
        const startMin = timeToMinutes(input.startTime);
        const endMin = timeToMinutes(input.endTime);
        const allPrices = court.prices.map((p) => ({
            dayType: p.dayType,
            startMin: timeToMinutes(p.startTime.toISOString().slice(11, 16)),
            endMin: timeToMinutes(p.endTime.toISOString().slice(11, 16)),
            price: Number(p.price)
        }));
        let matchingPrice = allPrices.find((p) => p.dayType === dayType && p.startMin <= startMin && p.endMin >= endMin);
        if (!matchingPrice) {
            matchingPrice = allPrices.find((p) => p.dayType === dayType && p.startMin < endMin && p.endMin > startMin);
        }
        if (!matchingPrice) {
            matchingPrice = allPrices.find((p) => p.dayType === dayType);
        }
        if (!matchingPrice && allPrices.length > 0) {
            matchingPrice = allPrices[0];
        }
        if (!matchingPrice)
            throw new ValidationError("Khung giờ này chưa có bảng giá. Vui lòng thiết lập bảng giá cho sân.");
        const serviceIds = input.services.map((service) => service.serviceId);
        const services = serviceIds.length ? await bookingRepository.services(serviceIds) : [];
        if (services.length !== serviceIds.length)
            throw new ValidationError("Dich vu khong hop le");
        const serviceLines = input.services.map((line) => {
            const service = services.find((item) => item.id === line.serviceId);
            return { serviceId: line.serviceId, quantity: line.quantity, price: Number(service.price) };
        });
        const courtTotal = matchingPrice.price * durationHours(input.startTime, input.endTime);
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
    async getForUser(userId, bookingId) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking)
            throw new NotFoundError("Khong tim thay don dat san");
        if (booking.userId !== userId)
            throw new ForbiddenError();
        return booking;
    },
    async listForUser(userId, query) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit);
        const [items, total] = await bookingRepository.listByUser(userId, page, limit);
        return { items, meta: paginationMeta(page, limit, total) };
    },
    async cancel(userId, bookingId, cancelReason) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking)
            throw new NotFoundError("Khong tim thay don dat san");
        if (booking.userId !== userId)
            throw new ForbiddenError();
        const blockedStatuses = [BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.CANCELLED];
        if (blockedStatuses.includes(booking.bookingStatus)) {
            throw new ValidationError("Don nay khong the huy");
        }
        const startAt = bookingStartsAt(booking.bookingDate, booking.startTime);
        const minCancelAt = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);
        if (new Date() > minCancelAt)
            throw new ValidationError("Chi duoc huy truoc gio bat dau it nhat 2 gio");
        const result = await bookingRepository.cancel(bookingId, {
            cancelReason,
            refundAmount: 0,
            platformRetainedAmount: 0,
            paymentStatus: "CANCELLED"
        });
        if (result.settlement) {
            const partnerId = result.settlement.partnerId;
            realtimeService.toPartner(partnerId, realtimeEvents.settlementUpdated, result.settlement);
            realtimeService.toAdmin(realtimeEvents.settlementUpdated, result.settlement);
            realtimeService.toPartner(partnerId, realtimeEvents.walletUpdated, { partnerId });
            realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId });
        }
        return result;
    }
};
