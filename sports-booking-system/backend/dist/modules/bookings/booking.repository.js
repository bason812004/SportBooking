import { prisma } from "../../config/db.js";
import { timeToDate, toDbDate } from "../../shared/utils/time.js";
function generateShortId(prefix) {
    const rand = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36).slice(-8);
    return `${prefix}${rand}${time}`.slice(0, 20);
}
export const bookingRepository = {
    findById(id) {
        return prisma.booking.findUnique({
            where: { id },
            include: {
                court: { include: { images: true, category: true, partner: true } },
                bookingServices: { include: { service: true } },
                review: true
            }
        });
    },
    listByUser(userId, page, limit) {
        const where = { userId };
        return prisma.$transaction([
            prisma.booking.findMany({
                where,
                include: { court: { include: { images: true, category: true } }, bookingServices: { include: { service: true } } },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.booking.count({ where })
        ]);
    },
    create(data) {
        return prisma.booking.create({
            data,
            include: { court: true, bookingServices: { include: { service: true } } }
        });
    },
    cancel(id, data) {
        return prisma.booking.update({
            where: { id },
            data: {
                bookingStatus: "CANCELLED",
                cancelReason: data.cancelReason,
                refundAmount: data.refundAmount,
                platformRetainedAmount: data.platformRetainedAmount,
                paymentStatus: data.paymentStatus,
                cancelledAt: new Date()
            },
            include: { court: true }
        });
    },
    courtWithPricing(id) {
        return prisma.court.findFirst({
            where: { id, approvalStatus: "APPROVED", activeStatus: "ACTIVE" },
            include: { prices: true, services: true, images: { orderBy: { sortOrder: "asc" } } }
        });
    },
    services(ids) {
        return prisma.courtService.findMany({ where: { id: { in: ids }, status: "ACTIVE" } });
    },
    createWithServices(input) {
        return prisma.$transaction(async (tx) => {
            const bookingId = generateShortId("bk");
            const booking = await tx.booking.create({
                data: {
                    id: bookingId,
                    bookingCode: input.bookingCode,
                    userId: input.userId,
                    courtId: input.courtId,
                    bookingDate: input.bookingDate,
                    startTime: input.startTime,
                    endTime: input.endTime,
                    basePrice: input.basePrice,
                    dynamicAdjustmentAmount: input.dynamicAdjustmentAmount,
                    subtotal: input.subtotal,
                    voucherDiscountAmount: input.voucherDiscountAmount,
                    demandPredictionSnapshot: input.demandPredictionSnapshot ?? undefined,
                    totalPrice: input.totalPrice,
                    depositAmount: input.depositAmount,
                    paymentMethod: input.paymentMethod,
                    note: input.note,
                    bookingServices: {
                        create: input.services.map((service) => ({
                            id: generateShortId("bs"),
                            serviceId: service.serviceId,
                            quantity: service.quantity,
                            price: service.price
                        }))
                    }
                },
                include: { court: true, bookingServices: { include: { service: true } } }
            });
            if (input.voucherId && input.voucherDiscountAmount > 0) {
                await tx.bookingVoucher.create({
                    data: {
                        id: generateShortId("bv"),
                        bookingId: booking.id,
                        voucherId: input.voucherId,
                        discountAmount: input.voucherDiscountAmount
                    }
                });
                await tx.voucher.update({
                    where: { id: input.voucherId },
                    data: { usedCount: { increment: 1 } }
                });
                await tx.userVoucher.updateMany({
                    where: { userId: input.userId, voucherId: input.voucherId, status: "CLAIMED" },
                    data: { status: "USED", usedAt: new Date() }
                });
            }
            return booking;
        });
    },
    findConflictsInTransaction(tx, courtId, date, slots) {
        const activeStatuses = ["PENDING", "CONFIRMED", "COMPLETED"];
        return Promise.all(slots.map(async (slot) => {
            const legacyBooking = await tx.booking.findFirst({
                where: {
                    courtId,
                    bookingDate: toDbDate(date),
                    bookingStatus: { in: activeStatuses },
                    startTime: { lt: timeToDate(slot.endTime.slice(0, 5)) },
                    endTime: { gt: timeToDate(slot.startTime.slice(0, 5)) }
                }
            });
            const slotBooking = await tx.bookingSlot.findFirst({
                where: {
                    courtId,
                    bookingDate: toDbDate(date),
                    startTime: { lt: timeToDate(slot.endTime.slice(0, 5)) },
                    endTime: { gt: timeToDate(slot.startTime.slice(0, 5)) },
                    booking: { bookingStatus: { in: activeStatuses } }
                }
            });
            return legacyBooking ?? slotBooking;
        }));
    },
    createCheckout(input) {
        return prisma.$transaction(async (tx) => {
            const conflicts = await this.findConflictsInTransaction(tx, input.courtId, input.bookingDate, input.slots);
            if (conflicts.some(Boolean))
                return { conflict: true };
            const sortedSlots = [...input.slots].sort((left, right) => left.startTime.localeCompare(right.startTime));
            const firstSlot = sortedSlots[0];
            const lastSlot = sortedSlots[sortedSlots.length - 1];
            const bookingId = generateShortId("bk");
            const booking = await tx.booking.create({
                data: {
                    id: bookingId,
                    bookingCode: input.bookingCode,
                    userId: input.userId,
                    courtId: input.courtId,
                    bookingDate: toDbDate(input.bookingDate),
                    startTime: timeToDate(firstSlot.startTime),
                    endTime: timeToDate(lastSlot.endTime),
                    basePrice: input.subtotal,
                    dynamicAdjustmentAmount: 0,
                    subtotal: input.subtotal,
                    voucherDiscountAmount: input.voucherDiscountAmount,
                    totalPrice: input.totalAmount,
                    depositAmount: input.depositAmount,
                    paymentMethod: "QR_TRANSFER",
                    paymentStatus: "PENDING",
                    bookingStatus: "PENDING_PAYMENT",
                    note: input.note,
                    bookingSlots: {
                        create: sortedSlots.map((slot) => ({
                            courtId: input.courtId,
                            bookingDate: toDbDate(input.bookingDate),
                            startTime: timeToDate(slot.startTime),
                            endTime: timeToDate(slot.endTime),
                            slotPrice: slot.price
                        }))
                    }
                },
                include: { court: true, bookingSlots: true }
            });
            if (input.voucherId && input.voucherDiscountAmount > 0) {
                await tx.bookingVoucher.create({
                    data: {
                        id: generateShortId("bv"),
                        bookingId: booking.id,
                        voucherId: input.voucherId,
                        discountAmount: input.voucherDiscountAmount
                    }
                });
                await tx.voucher.update({ where: { id: input.voucherId }, data: { usedCount: { increment: 1 } } });
            }
            const payment = await tx.payment.create({
                data: {
                    bookingId: booking.id,
                    userId: input.userId,
                    provider: input.provider,
                    paymentMethod: "QR_TRANSFER",
                    paymentType: input.paymentType,
                    amount: input.paymentAmount,
                    currency: "VND",
                    status: "PENDING",
                    externalOrderId: input.externalOrderId,
                    qrCodeUrl: input.qrCodeUrl ?? undefined,
                    qrPayload: input.qrPayload ?? undefined,
                    paymentReference: input.paymentReference,
                    expiresAt: input.expiresAt
                }
            });
            return { conflict: false, booking, payment };
        }, { isolationLevel: "Serializable" });
    },
    toDbDate
};
