import { prisma } from "../../config/db.js";
import { toDbDate } from "../../shared/utils/time.js";
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
            include: { prices: true, services: true }
        });
    },
    services(ids) {
        return prisma.courtService.findMany({ where: { id: { in: ids }, status: "ACTIVE" } });
    },
    createWithServices(input) {
        return prisma.$transaction(async (tx) => {
            const booking = await tx.booking.create({
                data: {
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
    toDbDate
};
