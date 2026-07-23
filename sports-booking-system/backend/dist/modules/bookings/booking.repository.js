import { prisma } from "../../config/db.js";
import { ValidationError } from "../../shared/errors/AppError.js";
import { timeToDate, toDbDate } from "../../shared/utils/time.js";
function generateShortId(prefix) {
    const rand = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36).slice(-8);
    return `${prefix}${rand}${time}`.slice(0, 20);
}
let depositColumnReady = false;
async function ensureCourtDepositColumn() {
    if (depositColumnReady)
        return;
    await prisma.$executeRaw `
    alter table courts
    add column if not exists deposit_percent numeric(5, 2) null
  `;
    depositColumnReady = true;
}
/**
 * Compute platform/partner split of a voucher discount.
 * PLATFORM-funded voucher: partner=0, platform=full.
 * PARTNER-funded voucher: partner=full, platform=0.
 * SHARED voucher: uses partner_funding_percent / platform_funding_percent.
 */
async function voucherDiscountSplit(tx, voucherId, discountAmount) {
    const row = await tx.voucher.findUnique({
        where: { id: voucherId },
        select: {
            fundedBy: true,
            partnerFundingPercent: true,
            platformFundingPercent: true
        }
    });
    if (!row)
        return { partnerShare: discountAmount, platformShare: 0 };
    const funded = (row.fundedBy ?? "PARTNER");
    if (funded === "PLATFORM") {
        return { partnerShare: 0, platformShare: discountAmount };
    }
    if (funded === "SHARED") {
        const pf = row.partnerFundingPercent != null ? Number(row.partnerFundingPercent) : 50;
        const partnerShare = Math.round((discountAmount * pf) / 100);
        return { partnerShare, platformShare: Math.max(0, discountAmount - partnerShare) };
    }
    return { partnerShare: discountAmount, platformShare: 0 };
}
export const bookingRepository = {
    findById(id) {
        return prisma.booking.findUnique({
            where: { id },
            include: {
                court: { include: { images: { orderBy: { sortOrder: "asc" } }, category: true, partner: true } },
                bookingServices: { include: { service: true } },
                bookingVoucher: { include: { voucher: { include: { partner: true, court: true } } } },
                payments: { orderBy: { createdAt: "desc" } },
                review: true
            }
        });
    },
    listByUser(userId, page, limit) {
        const where = { userId };
        return prisma.$transaction([
            prisma.booking.findMany({
                where,
                include: {
                    court: { include: { images: { orderBy: { sortOrder: "asc" } }, category: true, partner: true } },
                    bookingServices: { include: { service: true } },
                    bookingVoucher: { include: { voucher: true } },
                    payments: { orderBy: { createdAt: "desc" }, take: 1 }
                },
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
    cancel(id, data, db = prisma) {
        return db.booking.update({
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
    async courtDepositPercent(id) {
        await ensureCourtDepositColumn();
        const [row] = await prisma.$queryRaw `
      select deposit_percent::float as "depositPercent"
      from courts
      where id = ${id}
      limit 1
    `;
        return Number(row?.depositPercent ?? 0);
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
                const voucherUpdate = await tx.voucher.updateMany({
                    where: {
                        id: input.voucherId,
                        status: "ACTIVE",
                        OR: [{ usageLimit: null }, { usedCount: { lt: tx.voucher.fields.usageLimit } }]
                    },
                    data: { usedCount: { increment: 1 } }
                });
                if (voucherUpdate.count !== 1) {
                    throw new ValidationError("Voucher da het luot su dung");
                }
                const split = await voucherDiscountSplit(tx, input.voucherId, input.voucherDiscountAmount);
                await tx.bookingVoucher.create({
                    data: {
                        id: generateShortId("bv"),
                        bookingId: booking.id,
                        voucherId: input.voucherId,
                        discountAmount: input.voucherDiscountAmount,
                        platformShare: split.platformShare,
                        partnerShare: split.partnerShare
                    }
                });
                await tx.userVoucher.updateMany({
                    where: { userId: input.userId, voucherId: input.voucherId, status: "CLAIMED" },
                    data: { status: "USED", usedAt: new Date() }
                });
            }
            return booking;
        });
    },
    async findConflictsInTransaction(tx, courtId, date, slots) {
        const activeStatuses = ["PENDING", "PENDING_PAYMENT", "CONFIRMED", "COMPLETED"];
        const bookingDate = toDbDate(date);
        const conflicts = [];
        for (const slot of slots) {
            const startTime = timeToDate(slot.startTime.slice(0, 5));
            const endTime = timeToDate(slot.endTime.slice(0, 5));
            const legacyBooking = await tx.booking.findFirst({
                where: {
                    courtId,
                    bookingDate,
                    bookingStatus: { in: activeStatuses },
                    startTime: { lt: endTime },
                    endTime: { gt: startTime }
                }
            });
            if (legacyBooking) {
                conflicts.push(legacyBooking);
                continue;
            }
            const slotBooking = await tx.bookingSlot.findFirst({
                where: {
                    courtId,
                    bookingDate,
                    startTime: { lt: endTime },
                    endTime: { gt: startTime },
                    booking: { bookingStatus: { in: activeStatuses } }
                }
            });
            conflicts.push(slotBooking);
        }
        return conflicts;
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
                    basePrice: input.courtSubtotal,
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
                    },
                    bookingServices: {
                        create: input.services.map((service) => ({
                            id: generateShortId("bs"),
                            serviceId: service.serviceId,
                            quantity: service.quantity,
                            price: service.price
                        }))
                    }
                },
                include: { court: true, bookingSlots: true, bookingServices: { include: { service: true } } }
            });
            if (input.voucherId && input.voucherDiscountAmount > 0) {
                const voucherUpdate = await tx.voucher.updateMany({
                    where: {
                        id: input.voucherId,
                        status: "ACTIVE",
                        OR: [{ usageLimit: null }, { usedCount: { lt: tx.voucher.fields.usageLimit } }]
                    },
                    data: { usedCount: { increment: 1 } }
                });
                if (voucherUpdate.count !== 1) {
                    throw new ValidationError("Voucher da het luot su dung");
                }
                const split = await voucherDiscountSplit(tx, input.voucherId, input.voucherDiscountAmount);
                await tx.bookingVoucher.create({
                    data: {
                        id: generateShortId("bv"),
                        bookingId: booking.id,
                        voucherId: input.voucherId,
                        discountAmount: input.voucherDiscountAmount,
                        platformShare: split.platformShare,
                        partnerShare: split.partnerShare
                    }
                });
                await tx.userVoucher.updateMany({
                    where: { userId: input.userId, voucherId: input.voucherId, status: "CLAIMED" },
                    data: { status: "USED", usedAt: new Date() }
                });
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
        }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 });
    },
    createPayAtCourtCheckout(input) {
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
                    basePrice: input.courtSubtotal,
                    dynamicAdjustmentAmount: 0,
                    subtotal: input.subtotal,
                    voucherDiscountAmount: input.voucherDiscountAmount,
                    totalPrice: input.totalAmount,
                    depositAmount: 0,
                    paymentMethod: "CASH",
                    paymentStatus: "UNPAID",
                    bookingStatus: "CONFIRMED",
                    note: input.note,
                    bookingSlots: {
                        create: sortedSlots.map((slot) => ({
                            courtId: input.courtId,
                            bookingDate: toDbDate(input.bookingDate),
                            startTime: timeToDate(slot.startTime),
                            endTime: timeToDate(slot.endTime),
                            slotPrice: slot.price
                        }))
                    },
                    bookingServices: {
                        create: input.services.map((service) => ({
                            id: generateShortId("bs"),
                            serviceId: service.serviceId,
                            quantity: service.quantity,
                            price: service.price
                        }))
                    }
                },
                include: { court: true, bookingSlots: true, bookingServices: { include: { service: true } } }
            });
            if (input.voucherId && input.voucherDiscountAmount > 0) {
                const voucherUpdate = await tx.voucher.updateMany({
                    where: {
                        id: input.voucherId,
                        status: "ACTIVE",
                        OR: [{ usageLimit: null }, { usedCount: { lt: tx.voucher.fields.usageLimit } }]
                    },
                    data: { usedCount: { increment: 1 } }
                });
                if (voucherUpdate.count !== 1) {
                    throw new ValidationError("Voucher da het luot su dung");
                }
                const split = await voucherDiscountSplit(tx, input.voucherId, input.voucherDiscountAmount);
                await tx.bookingVoucher.create({
                    data: {
                        id: generateShortId("bv"),
                        bookingId: booking.id,
                        voucherId: input.voucherId,
                        discountAmount: input.voucherDiscountAmount,
                        platformShare: split.platformShare,
                        partnerShare: split.partnerShare
                    }
                });
                await tx.userVoucher.updateMany({
                    where: { userId: input.userId, voucherId: input.voucherId, status: "CLAIMED" },
                    data: { status: "USED", usedAt: new Date() }
                });
            }
            return { conflict: false, booking };
        }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 });
    },
    toDbDate
};
