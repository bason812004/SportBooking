import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { bookingStartsAt, durationHours, parseLimit, parsePage, timeToDate, timeToMinutes, toDbDate } from "../../shared/utils/time.js";
import { courtRepository } from "../courts/court.repository.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { demandPredictionService } from "../demand-prediction/demandPrediction.service.js";
import { dynamicPricingService } from "../dynamic-pricing/dynamicPricing.service.js";
import { voucherService } from "../vouchers/voucher.service.js";
import { voucherRepository } from "../vouchers/voucher.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { paymentProvider } from "../payments/providers/index.js";
import { settlementService } from "../settlements/settlement.service.js";
import { bookingRepository } from "./booking.repository.js";
import { calculateBookingQuote, canCreateBookingCheckout, checkBookingOverlap, validateSelectedSlots } from "./booking.calculations.js";
function bookingCode() {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    return `BK${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}
function paymentReference() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `SBK-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
function minutesRange(slots) {
    const sorted = [...slots].sort((left, right) => left.startTime.localeCompare(right.startTime));
    return { startTime: sorted[0].startTime, endTime: sorted[sorted.length - 1].endTime };
}
async function buildQuote(userId, input) {
    if (!validateSelectedSlots(input.slots))
        throw new ValidationError("Khung gio da chon khong hop le");
    const duplicateOverlap = input.slots.some((slot, index) => input.slots.some((other, otherIndex) => index !== otherIndex && checkBookingOverlap(slot, other)));
    if (duplicateOverlap)
        throw new ValidationError("Cac khung gio da chon bi trung nhau");
    const court = await bookingRepository.courtWithPricing(input.courtId);
    if (!court)
        throw new NotFoundError("San khong ton tai hoac chua duoc duyet");
    const [blocks, legacyBookings, bookingSlots] = await Promise.all([
        courtRepository.availabilityBlocks(input.courtId, input.bookingDate),
        courtRepository.availability(input.courtId, input.bookingDate),
        courtRepository.bookingSlots(input.courtId, input.bookingDate)
    ]);
    const activeBookings = legacyBookings.filter(b => {
        const isPending = b.bookingStatus === "PENDING" || b.bookingStatus === "PENDING_PAYMENT";
        if (isPending) {
            if (!b.payments || b.payments.length === 0)
                return true;
            const activePayment = b.payments.find((p) => p.status === "PENDING" || p.status === "UNPAID");
            if (!activePayment)
                return false;
            const isExpired = activePayment.expiresAt.getTime() <= Date.now();
            return !isExpired;
        }
        return true;
    });
    const activeBookingSlots = bookingSlots.filter(bs => {
        const isPending = bs.booking.bookingStatus === "PENDING" || bs.booking.bookingStatus === "PENDING_PAYMENT";
        if (isPending) {
            if (!bs.booking.payments || bs.booking.payments.length === 0)
                return true;
            const activePayment = bs.booking.payments.find((p) => p.status === "PENDING" || p.status === "UNPAID");
            if (!activePayment)
                return false;
            const isExpired = activePayment.expiresAt.getTime() <= Date.now();
            return !isExpired;
        }
        return true;
    });
    for (const slot of input.slots) {
        const blocked = blocks.some((block) => checkBookingOverlap(slot, { startTime: block.startTime.toISOString().slice(11, 16), endTime: block.endTime.toISOString().slice(11, 16) }));
        const booked = activeBookings.some((booking) => checkBookingOverlap(slot, { startTime: booking.startTime.toISOString().slice(11, 16), endTime: booking.endTime.toISOString().slice(11, 16) }));
        const bookedSlot = activeBookingSlots.some((bookingSlot) => checkBookingOverlap(slot, { startTime: bookingSlot.startTime.toISOString().slice(11, 16), endTime: bookingSlot.endTime.toISOString().slice(11, 16) }));
        if (blocked || booked || bookedSlot)
            throw new ConflictError("Mot hoac nhieu khung gio da duoc dat hoac bi khoa", "BOOKING_CONFLICT");
    }
    const pricedSlots = await Promise.all(input.slots.map(async (slot) => {
        const dynamicPrice = await dynamicPricingService.calculate(input.courtId, {
            date: input.bookingDate,
            startTime: slot.startTime,
            endTime: slot.endTime
        });
        const hours = durationHours(slot.startTime, slot.endTime);
        return { ...slot, price: dynamicPrice.finalPrice * hours };
    }));
    const courtSubtotal = pricedSlots.reduce((sum, slot) => sum + slot.price, 0);
    const serviceIds = (input.services ?? []).map((service) => service.serviceId);
    const services = serviceIds.length ? await bookingRepository.services(serviceIds) : [];
    if (services.length !== serviceIds.length)
        throw new ValidationError("Dich vu khong hop le");
    const serviceLines = (input.services ?? []).map((line) => {
        const service = services.find((item) => item.id === line.serviceId);
        return {
            serviceId: line.serviceId,
            name: service.name,
            quantity: line.quantity,
            price: Number(service.price),
            total: Number(service.price) * line.quantity
        };
    });
    const servicesSubtotal = serviceLines.reduce((sum, line) => sum + line.total, 0);
    const subtotal = courtSubtotal + servicesSubtotal;
    let voucherDiscountAmount = 0;
    let voucherId;
    if (input.voucherId) {
        const voucherResult = await voucherService.apply({ userId, voucherId: input.voucherId, courtId: input.courtId, subtotal });
        voucherDiscountAmount = voucherResult.discountAmount;
        voucherId = voucherResult.voucherId;
    }
    else if (input.voucherCode) {
        const voucherResult = await voucherService.apply({ userId, code: input.voucherCode, courtId: input.courtId, subtotal });
        voucherDiscountAmount = voucherResult.discountAmount;
        voucherId = voucherResult.voucherId;
    }
    const depositPercent = await bookingRepository.courtDepositPercent(input.courtId);
    const quote = calculateBookingQuote(pricedSlots, voucherDiscountAmount, servicesSubtotal, depositPercent);
    return {
        court: {
            id: court.id,
            name: court.name,
            address: [court.address, court.district, court.city].filter(Boolean).join(", "),
            imageUrl: court.images?.[0]?.imageUrl ?? null
        },
        bookingDate: input.bookingDate,
        slots: pricedSlots,
        services: serviceLines,
        courtSubtotal,
        servicesSubtotal,
        voucherId,
        depositPercent,
        requiresDeposit: depositPercent > 0,
        currency: "VND",
        quoteExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        ...quote
    };
}
export const bookingService = {
    async quote(userId, input) {
        return buildQuote(userId, input);
    },
    async checkout(userId, input) {
        const quote = await buildQuote(userId, input);
        if (!canCreateBookingCheckout({ totalAmount: quote.totalAmount, paymentType: input.paymentType, depositPercent: quote.depositPercent })) {
            throw new ValidationError("Lua chon thanh toan khong hop le");
        }
        if (input.paymentType === "PAY_AT_COURT") {
            const result = await bookingRepository.createPayAtCourtCheckout({
                bookingCode: bookingCode(),
                userId,
                courtId: input.courtId,
                bookingDate: input.bookingDate,
                slots: quote.slots,
                services: quote.services,
                courtSubtotal: quote.courtSubtotal,
                subtotal: quote.subtotal,
                voucherDiscountAmount: quote.voucherDiscountAmount,
                totalAmount: quote.totalAmount,
                voucherId: quote.voucherId,
                note: input.note
            });
            if (result.conflict)
                throw new ConflictError("Mot hoac nhieu khung gio vua duoc dat boi nguoi khac", "BOOKING_CONFLICT");
            realtimeService.toUser(userId, realtimeEvents.bookingCreated, result.booking);
            realtimeService.toCourt(input.courtId, realtimeEvents.courtAvailabilityUpdated, { courtId: input.courtId, bookingDate: input.bookingDate });
            return {
                bookingId: result.booking.id,
                paymentId: null,
                bookingStatus: result.booking.bookingStatus,
                paymentStatus: result.booking.paymentStatus,
                paymentType: input.paymentType,
                totalAmount: quote.totalAmount,
                paymentAmount: 0,
                remainingAmount: quote.totalAmount,
                qrCodeUrl: null,
                qrPayload: null,
                paymentReference: "",
                expiresAt: null,
                providerConfigured: true
            };
        }
        const paymentAmount = input.paymentType === "DEPOSIT" ? quote.minimumDepositAmount : quote.totalAmount;
        const remainingAmount = quote.totalAmount - paymentAmount;
        const expiresAt = new Date(Date.now() + env.BOOKING_HOLD_EXPIRES_MINUTES * 60 * 1000);
        const reference = paymentReference();
        const orderId = env.PAYMENT_PROVIDER === "PAYOS"
            ? String(Number(String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000)).padStart(3, "0")))
            : `${reference}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const providerResult = await paymentProvider.createQrPayment({
            amount: paymentAmount,
            currency: "VND",
            orderId,
            paymentReference: reference,
            description: `Thanh toan dat san ${quote.court.name}`,
            expiresAt
        });
        const result = await bookingRepository.createCheckout({
            bookingCode: bookingCode(),
            userId,
            courtId: input.courtId,
            bookingDate: input.bookingDate,
            slots: quote.slots,
            services: quote.services,
            courtSubtotal: quote.courtSubtotal,
            subtotal: quote.subtotal,
            voucherDiscountAmount: quote.voucherDiscountAmount,
            totalAmount: quote.totalAmount,
            depositAmount: quote.minimumDepositAmount,
            paymentType: input.paymentType,
            paymentAmount,
            voucherId: quote.voucherId,
            note: input.note,
            provider: providerResult.provider,
            externalOrderId: providerResult.externalOrderId,
            qrCodeUrl: providerResult.qrCodeUrl,
            qrPayload: providerResult.qrPayload,
            paymentReference: reference,
            expiresAt
        });
        if (result.conflict)
            throw new ConflictError("Mot hoac nhieu khung gio vua duoc dat boi nguoi khac", "BOOKING_CONFLICT");
        realtimeService.toUser(userId, realtimeEvents.bookingPendingPayment, result.booking);
        realtimeService.toCourt(input.courtId, realtimeEvents.courtAvailabilityUpdated, { courtId: input.courtId, bookingDate: input.bookingDate });
        return {
            bookingId: result.booking.id,
            paymentId: result.payment.id,
            bookingStatus: result.booking.bookingStatus,
            paymentStatus: result.payment.status,
            paymentType: input.paymentType,
            totalAmount: quote.totalAmount,
            paymentAmount,
            remainingAmount,
            qrCodeUrl: result.payment.qrCodeUrl,
            qrPayload: result.payment.qrPayload,
            paymentReference: result.payment.paymentReference,
            expiresAt: result.payment.expiresAt,
            providerConfigured: providerResult.providerConfigured
        };
    },
    async create(userId, input) {
        if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) {
            throw new ValidationError("Gio bat dau phai nho hon gio ket thuc");
        }
        const conflict = await courtRepository.findConflict(input.courtId, input.bookingDate, input.startTime, input.endTime);
        if (conflict) {
            const isPending = conflict.bookingStatus === "PENDING" || conflict.bookingStatus === "PENDING_PAYMENT";
            let isExpired = false;
            if (isPending) {
                if (!conflict.payments || conflict.payments.length === 0) {
                    isExpired = false;
                }
                else {
                    const activePayment = conflict.payments.find((p) => p.status === "PENDING" || p.status === "UNPAID");
                    isExpired = !activePayment ? true : activePayment.expiresAt.getTime() <= Date.now();
                }
            }
            if (!isExpired) {
                throw new ConflictError("Khung gio nay da co nguoi dat.", "BOOKING_CONFLICT");
            }
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
            if (!claimed || claimed.status !== "CLAIMED") {
                throw new ValidationError("Ban chua nhan voucher nay hoac voucher da duoc su dung");
            }
            const voucherResult = await voucherService.apply({ userId, voucherId, courtId: input.courtId, subtotal });
            voucherDiscountAmount = voucherResult.discountAmount;
            voucherId = voucherResult.voucherId;
        }
        else if (input.voucherCode) {
            const voucherResult = await voucherService.apply({ userId, code: input.voucherCode, courtId: input.courtId, subtotal });
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
        const totalPrice = subtotal - voucherDiscountAmount;
        const depositPercent = await bookingRepository.courtDepositPercent(input.courtId);
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
            totalPrice,
            depositAmount: Math.round(totalPrice * (depositPercent / 100) * 100) / 100,
            paymentMethod: input.paymentMethod,
            voucherId,
            note: input.note,
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
        await notificationService.create({
            userId,
            title: "Dat san thanh cong",
            content: `Don ${booking.bookingCode} da duoc tao thanh cong.`,
            type: "BOOKING_CREATED",
            metadata: { bookingId: booking.id, courtId: input.courtId }
        });
        realtimeService.toUser(userId, realtimeEvents.bookingCreated, booking);
        realtimeService.toCourt(input.courtId, realtimeEvents.courtAvailabilityUpdated, {
            courtId: input.courtId,
            bookingDate: input.bookingDate,
            startTime: input.startTime,
            endTime: input.endTime
        });
        realtimeService.toPartner(court.partnerId, "partner:booking-created", booking);
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
        if (new Date() >= startAt)
            throw new ValidationError("Khong the huy sau gio bat dau");
        const hoursUntilStart = (startAt.getTime() - Date.now()) / (60 * 60 * 1000);
        const paidAmount = booking.paymentStatus === "PAID" ? Number(booking.totalPrice) : 0;
        const refundAmount = hoursUntilStart >= 24 ? paidAmount : paidAmount * 0.5;
        const platformRetainedAmount = paidAmount - refundAmount;
        const paymentStatus = paidAmount === 0
            ? "UNPAID"
            : refundAmount === paidAmount
                ? "REFUNDED"
                : "PARTIALLY_REFUNDED";
        const { cancelled, settlement } = await prisma.$transaction(async (tx) => {
            const cancelledBooking = await bookingRepository.cancel(bookingId, {
                cancelReason,
                refundAmount,
                platformRetainedAmount,
                paymentStatus
            }, tx);
            const cancelledSettlement = await settlementService.cancelForBooking(bookingId, tx);
            return { cancelled: cancelledBooking, settlement: cancelledSettlement };
        });
        if (settlement) {
            realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
            realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
            realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
            realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
        }
        await notificationService.create({
            userId,
            title: "Don dat san da huy",
            content: `Don ${cancelled.bookingCode} da duoc huy.`,
            type: "BOOKING_CANCELLED",
            metadata: { bookingId: cancelled.id, courtId: cancelled.courtId }
        });
        realtimeService.toUser(userId, realtimeEvents.bookingCancelled, cancelled);
        realtimeService.toBooking(bookingId, realtimeEvents.bookingCancelled, cancelled);
        realtimeService.toCourt(cancelled.courtId, realtimeEvents.courtAvailabilityUpdated, {
            courtId: cancelled.courtId,
            bookingDate: cancelled.bookingDate,
            startTime: cancelled.startTime,
            endTime: cancelled.endTime
        });
        return cancelled;
    }
};
