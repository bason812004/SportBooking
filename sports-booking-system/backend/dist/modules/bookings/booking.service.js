import { BookingStatus } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { bookingStartsAt, durationHours, parseLimit, parsePage, timeToDate, timeToMinutes, toDbDate } from "../../shared/utils/time.js";
import { courtRepository } from "../courts/court.repository.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { demandPredictionService } from "../demand-prediction/demandPrediction.service.js";
import { dynamicPricingService } from "../dynamic-pricing/dynamicPricing.service.js";
import { voucherService } from "../vouchers/voucher.service.js";
import { voucherRepository } from "../vouchers/voucher.repository.js";
import { bookingRepository } from "./booking.repository.js";
function bookingCode() {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    return `BK${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}
export const bookingService = {
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
        const serviceIds = input.services.map((service) => service.serviceId);
        const services = serviceIds.length ? await bookingRepository.services(serviceIds) : [];
        if (services.length !== serviceIds.length)
            throw new ValidationError("Dich vu khong hop le");
        const serviceLines = input.services.map((line) => {
            const service = services.find((item) => item.id === line.serviceId);
            return { serviceId: line.serviceId, quantity: line.quantity, price: Number(service.price) };
        });
        const dynamicPrice = await dynamicPricingService.calculate(input.courtId, {
            date: input.bookingDate,
            startTime: input.startTime,
            endTime: input.endTime
        });
        const hours = durationHours(input.startTime, input.endTime);
        const courtTotal = dynamicPrice.finalPrice * hours;
        const basePriceTotal = dynamicPrice.basePrice * hours;
        const dynamicAdjustmentAmount = dynamicPrice.dynamicAdjustmentAmount * hours;
        const serviceTotal = serviceLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
        const subtotal = courtTotal + serviceTotal;
        let voucherDiscountAmount = 0;
        let voucherId = input.voucherId;
        if (voucherId) {
            const claimed = await voucherRepository.userVoucher(userId, voucherId);
            if (!claimed || claimed.status !== "CLAIMED")
                throw new ValidationError("Ban chua nhan voucher nay hoac voucher da duoc su dung");
            const voucherResult = await voucherService.apply({ userId, voucherId, courtId: input.courtId, subtotal });
            voucherDiscountAmount = voucherResult.discountAmount;
            voucherId = voucherResult.voucherId;
        }
        let demandPredictionSnapshot = null;
        try {
            demandPredictionSnapshot = await demandPredictionService.predict(input.courtId, {
                date: input.bookingDate,
                startTime: input.startTime,
                endTime: input.endTime
            });
        }
        catch {
            demandPredictionSnapshot = {
                courtId: input.courtId,
                predictedDemandScore: null,
                predictedOccupancyRate: null,
                predictionLevel: null,
                confidenceScore: 0,
                status: "INSUFFICIENT_DATA"
            };
        }
        const booking = await bookingRepository.createWithServices({
            bookingCode: bookingCode(),
            userId,
            courtId: input.courtId,
            bookingDate: toDbDate(input.bookingDate),
            startTime: timeToDate(input.startTime),
            endTime: timeToDate(input.endTime),
            basePrice: basePriceTotal,
            dynamicAdjustmentAmount,
            subtotal,
            voucherDiscountAmount,
            totalPrice: subtotal - voucherDiscountAmount,
            paymentMethod: input.paymentMethod,
            voucherId,
            demandPredictionSnapshot,
            services: serviceLines
        });
        await trackEvent({
            userId,
            partnerId: court.partnerId,
            eventType: "BOOKING_CREATED",
            entityType: "BOOKING",
            entityId: booking.id,
            metadataJson: {
                courtId: input.courtId,
                bookingDate: input.bookingDate,
                startTime: input.startTime,
                endTime: input.endTime,
                totalPrice: subtotal - voucherDiscountAmount
            }
        });
        return booking;
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
        const cancelled = await bookingRepository.cancel(bookingId, cancelReason);
        await trackEvent({ userId, partnerId: cancelled.court.partnerId, eventType: "BOOKING_CANCELLED", entityType: "BOOKING", entityId: bookingId });
        return cancelled;
    }
};
