import { prisma } from "../../config/db.js";
import { ValidationError } from "../../shared/errors/AppError.js";
import { timeToDate, toDbDate } from "../../shared/utils/time.js";
import { ensureServiceTables } from "../services/service.repository.js";
import { settlementService } from "../settlements/settlement.service.js";
function generateShortId(prefix) {
    const rand = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36).slice(-8);
    return `${prefix}${rand}${time}`.slice(0, 20);
}
let depositColumnReady = false;
export async function ensureBookingTables() {
    if (depositColumnReady)
        return;
    try {
        await prisma.$executeRaw `
      alter table courts
      add column if not exists deposit_percent numeric(5, 2) null
    `;
        depositColumnReady = true;
    }
    catch (err) {
        console.warn("[BookingRepository] Note on ensure booking tables:", err?.message || err);
    }
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
    async findById(id) {
        const booking = await prisma.booking.findFirst({
            where: { OR: [{ id }, { bookingOrderId: id }, { bookingCode: id }] },
            include: {
                court: { include: { images: { orderBy: { sortOrder: "asc" } }, category: true, partner: true } },
                bookingSlots: { include: { court_surfaces: true }, orderBy: { startTime: "asc" } },
                bookingServices: { include: { service: true } },
                bookingVoucher: { include: { voucher: { include: { partner: true, court: true } } } },
                payments: { orderBy: { createdAt: "desc" } },
                bookingOrder: {
                    include: {
                        bookings: {
                            include: {
                                bookingSlots: { include: { court_surfaces: true }, orderBy: { startTime: "asc" } },
                                bookingServices: { include: { service: true } }
                            },
                            orderBy: { bookingDate: "asc" }
                        },
                        payment: true
                    }
                },
                review: true
            }
        });
        if (!booking)
            return null;
        // If part of a multi-booking order, consolidate slots & pricing across order
        if (booking.bookingOrder && booking.bookingOrder.bookings.length > 1) {
            const allSlots = booking.bookingOrder.bookings.flatMap((b) => b.bookingSlots);
            const allServices = booking.bookingOrder.bookings.flatMap((b) => b.bookingServices);
            const totalOrderPrice = Number(booking.bookingOrder.totalAmount);
            const subtotal = Number(booking.bookingOrder.subtotal);
            const voucherDiscountAmount = Number(booking.bookingOrder.voucherDiscountAmount);
            const courtSubtotal = allSlots.reduce((sum, s) => sum + Number(s.slotPrice ?? 0), 0);
            return {
                ...booking,
                bookingSlots: allSlots,
                bookingServices: allServices,
                basePrice: courtSubtotal,
                totalPrice: totalOrderPrice,
                subtotal,
                voucherDiscountAmount,
                orderBookingsCount: booking.bookingOrder.bookings.length
            };
        }
        if (booking.bookingSlots && booking.bookingSlots.length > 0) {
            const courtSubtotal = booking.bookingSlots.reduce((sum, s) => sum + Number(s.slotPrice ?? 0), 0);
            return {
                ...booking,
                basePrice: courtSubtotal
            };
        }
        return booking;
    },
    listByUser(userId, page, limit) {
        const where = { userId };
        return prisma.$transaction([
            prisma.booking.findMany({
                where,
                select: {
                    id: true,
                    bookingCode: true,
                    bookingStatus: true,
                    paymentStatus: true,
                    paymentMethod: true,
                    bookingDate: true,
                    startTime: true,
                    endTime: true,
                    totalPrice: true,
                    subtotal: true,
                    createdAt: true,
                    court: {
                        select: {
                            id: true,
                            name: true,
                            address: true,
                            district: true,
                            city: true,
                            images: { orderBy: { sortOrder: "asc" }, take: 1 },
                            category: { select: { name: true } }
                        }
                    },
                    bookingServices: { include: { service: true } },
                    bookingVoucher: { include: { voucher: { select: { code: true } } } },
                    payments: { orderBy: { createdAt: "desc" }, take: 1 },
                    bookingOrder: { select: { payment: true } }
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
        return prisma.$transaction(async (tx) => {
            const updated = await tx.booking.update({
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
            const settlement = await settlementService.cancelForBooking(id, tx);
            const services = await tx.bookingService.findMany({
                where: { bookingId: id, status: "ACTIVE" }
            });
            for (const bs of services) {
                if (bs.serviceId && bs.quantity > 0) {
                    const inv = await tx.serviceInventory.findFirst({ where: { serviceId: bs.serviceId } });
                    if (inv) {
                        await tx.serviceInventory.update({
                            where: { id: inv.id },
                            data: { quantity: { increment: bs.quantity } }
                        });
                        await tx.inventoryTransaction.create({
                            data: {
                                serviceId: bs.serviceId,
                                type: "RENTAL_IN",
                                quantity: bs.quantity,
                                unitCost: inv.lastPurchasePrice,
                                referenceType: "BOOKING_CANCELLED",
                                referenceId: id,
                                note: `Hoàn kho do hủy booking ${id}`
                            }
                        });
                    }
                }
            }
            return { ...updated, settlement };
        });
    },
    courtWithPricing(id) {
        return prisma.court.findFirst({
            where: { id, approvalStatus: "APPROVED", activeStatus: "ACTIVE" },
            include: { prices: true, services: true, images: { orderBy: { sortOrder: "asc" } } }
        });
    },
    async courtDepositPercent(id) {
        await ensureBookingTables();
        const [row] = await prisma.$queryRaw `
      select deposit_percent::float as "depositPercent"
      from courts
      where id = ${id}
      limit 1
    `;
        return Number(row?.depositPercent ?? 0);
    },
    async services(ids) {
        await ensureServiceTables();
        const courtSvcs = await prisma.courtService.findMany({ where: { id: { in: ids }, status: "ACTIVE" } });
        const directSvcs = await prisma.service.findMany({ where: { id: { in: ids } } });
        const map = new Map();
        courtSvcs.forEach((s) => map.set(s.id, { id: s.id, name: s.name, price: s.price }));
        directSvcs.forEach((s) => map.set(s.id, { id: s.id, name: s.name, price: s.price }));
        return Array.from(map.values());
    },
    /** Creates `bookingService` rows for an already-created booking and deducts inventory, mirroring the checkout flow above. */
    async attachServicesToBooking(tx, bookingId, lines) {
        for (const line of lines) {
            await tx.bookingService.create({
                data: { id: generateShortId("bs"), bookingId, serviceId: line.serviceId, quantity: line.quantity, price: line.price }
            });
            const inv = await tx.serviceInventory.findFirst({ where: { serviceId: line.serviceId } });
            if (inv) {
                if (inv.quantity < line.quantity)
                    throw new ValidationError("Sản phẩm/dịch vụ không đủ tồn kho");
                await tx.serviceInventory.update({
                    where: { id: inv.id },
                    data: { quantity: { decrement: line.quantity } }
                });
                await tx.inventoryTransaction.create({
                    data: {
                        serviceId: line.serviceId,
                        type: "RENTAL_OUT",
                        quantity: line.quantity,
                        unitCost: inv.lastPurchasePrice,
                        referenceType: "BOOKING",
                        referenceId: bookingId,
                        note: `Đặt cùng đơn booking ${bookingId}`
                    }
                });
            }
        }
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
                const existingVoucher = await tx.voucher.findUnique({
                    where: { id: input.voucherId },
                    select: { id: true, usageLimit: true, usedCount: true, status: true }
                });
                if (!existingVoucher || existingVoucher.status !== "ACTIVE") {
                    throw new ValidationError("Voucher khong hop le");
                }
                if (existingVoucher.usageLimit !== null && existingVoucher.usedCount >= existingVoucher.usageLimit) {
                    throw new ValidationError("Voucher da het luot su dung");
                }
                await tx.voucher.update({
                    where: { id: input.voucherId },
                    data: { usedCount: { increment: 1 } }
                });
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
        const conflicts = [];
        for (const slot of slots) {
            const slotDateStr = slot.date || date;
            const bookingDate = toDbDate(slotDateStr);
            const startTime = timeToDate(slot.startTime.slice(0, 5));
            const endTime = timeToDate(slot.endTime.slice(0, 5));
            const surfaceId = slot.courtSurfaceId || slot.court_surface_id || slot.courtSubId || null;
            const legacyBooking = await tx.booking.findFirst({
                where: {
                    courtId,
                    bookingDate,
                    bookingStatus: { in: activeStatuses },
                    startTime: { lt: endTime },
                    endTime: { gt: startTime },
                    ...(surfaceId ? { OR: [{ courtSurfaceId: surfaceId }, { courtSurfaceId: null }] } : {})
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
                    booking: { bookingStatus: { in: activeStatuses } },
                    ...(surfaceId ? { OR: [{ court_surface_id: surfaceId }, { court_surface_id: null }] } : {})
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
            const primarySurfaceId = firstSlot.courtSurfaceId || firstSlot.court_surface_id || firstSlot.courtSubId || null;
            const bookingId = generateShortId("bk");
            const booking = await tx.booking.create({
                data: {
                    id: bookingId,
                    bookingCode: input.bookingCode,
                    userId: input.userId,
                    courtId: input.courtId,
                    courtSurfaceId: primarySurfaceId,
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
                            court_surface_id: slot.courtSurfaceId || slot.court_surface_id || slot.courtSubId || primarySurfaceId,
                            bookingDate: toDbDate(slot.date || input.bookingDate),
                            startTime: timeToDate(slot.startTime),
                            endTime: timeToDate(slot.endTime),
                            slotPrice: slot.finalPrice ?? slot.price
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
                const existingVoucher = await tx.voucher.findUnique({
                    where: { id: input.voucherId },
                    select: { id: true, usageLimit: true, usedCount: true, status: true }
                });
                if (!existingVoucher || existingVoucher.status !== "ACTIVE") {
                    throw new ValidationError("Voucher khong hop le");
                }
                if (existingVoucher.usageLimit !== null && existingVoucher.usedCount >= existingVoucher.usageLimit) {
                    throw new ValidationError("Voucher da het luot su dung");
                }
                await tx.voucher.update({
                    where: { id: input.voucherId },
                    data: { usedCount: { increment: 1 } }
                });
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
            const primarySurfaceId = firstSlot.courtSurfaceId || firstSlot.court_surface_id || firstSlot.courtSubId || null;
            const bookingId = generateShortId("bk");
            const booking = await tx.booking.create({
                data: {
                    id: bookingId,
                    bookingCode: input.bookingCode,
                    userId: input.userId,
                    courtId: input.courtId,
                    courtSurfaceId: primarySurfaceId,
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
                            court_surface_id: slot.courtSurfaceId || slot.court_surface_id || slot.courtSubId || primarySurfaceId,
                            bookingDate: toDbDate(slot.date || input.bookingDate),
                            startTime: timeToDate(slot.startTime),
                            endTime: timeToDate(slot.endTime),
                            slotPrice: slot.finalPrice ?? slot.price
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
                const existingVoucher = await tx.voucher.findUnique({
                    where: { id: input.voucherId },
                    select: { id: true, usageLimit: true, usedCount: true, status: true }
                });
                if (!existingVoucher || existingVoucher.status !== "ACTIVE") {
                    throw new ValidationError("Voucher khong hop le");
                }
                if (existingVoucher.usageLimit !== null && existingVoucher.usedCount >= existingVoucher.usageLimit) {
                    throw new ValidationError("Voucher da het luot su dung");
                }
                await tx.voucher.update({
                    where: { id: input.voucherId },
                    data: { usedCount: { increment: 1 } }
                });
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
    createOrderCheckout(input) {
        return prisma.$transaction(async (tx) => {
            for (const day of input.days) {
                const conflicts = await this.findConflictsInTransaction(tx, input.courtId, day.bookingDate, day.slots);
                if (conflicts.some(Boolean))
                    return { conflict: true, conflictDate: day.bookingDate };
            }
            const orderId = generateShortId("bo");
            await tx.bookingOrder.create({
                data: {
                    id: orderId,
                    userId: input.userId,
                    courtId: input.courtId,
                    subtotal: input.subtotal,
                    voucherDiscountAmount: input.voucherDiscountAmount,
                    totalAmount: input.totalAmount,
                    paymentType: input.paymentType,
                    status: "PENDING",
                    note: input.note
                }
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
                await tx.userVoucher.updateMany({
                    where: { userId: input.userId, voucherId: input.voucherId, status: "CLAIMED" },
                    data: { status: "USED", usedAt: new Date() }
                });
            }
            const bookings = [];
            for (const day of input.days) {
                const sortedSlots = [...day.slots].sort((left, right) => left.startTime.localeCompare(right.startTime));
                const firstSlot = sortedSlots[0];
                const lastSlot = sortedSlots[sortedSlots.length - 1];
                const primarySurfaceId = firstSlot.courtSurfaceId || firstSlot.court_surface_id || firstSlot.courtSubId || null;
                const bookingId = generateShortId("bk");
                const booking = await tx.booking.create({
                    data: {
                        id: bookingId,
                        bookingCode: day.bookingCode,
                        userId: input.userId,
                        courtId: input.courtId,
                        courtSurfaceId: primarySurfaceId,
                        bookingOrderId: orderId,
                        bookingDate: toDbDate(day.bookingDate),
                        startTime: timeToDate(firstSlot.startTime),
                        endTime: timeToDate(lastSlot.endTime),
                        basePrice: day.courtSubtotal,
                        dynamicAdjustmentAmount: 0,
                        subtotal: day.subtotal,
                        voucherDiscountAmount: day.voucherDiscountAmount,
                        totalPrice: day.totalAmount,
                        depositAmount: 0,
                        paymentMethod: "QR_TRANSFER",
                        paymentStatus: "PENDING",
                        bookingStatus: "PENDING_PAYMENT",
                        note: input.note,
                        bookingSlots: {
                            create: sortedSlots.map((slot) => ({
                                courtId: input.courtId,
                                court_surface_id: slot.courtSurfaceId || slot.court_surface_id || slot.courtSubId || primarySurfaceId,
                                bookingDate: toDbDate(day.bookingDate),
                                startTime: timeToDate(slot.startTime),
                                endTime: timeToDate(slot.endTime),
                                slotPrice: slot.finalPrice ?? slot.price
                            }))
                        },
                        bookingServices: {
                            create: day.services.map((service) => ({
                                id: generateShortId("bs"),
                                serviceId: service.serviceId,
                                quantity: service.quantity,
                                price: service.price
                            }))
                        }
                    },
                    include: { court: true, bookingSlots: true, bookingServices: { include: { service: true } } }
                });
                bookings.push(booking);
                if (input.voucherId && day.voucherDiscountAmount > 0) {
                    const split = await voucherDiscountSplit(tx, input.voucherId, day.voucherDiscountAmount);
                    await tx.bookingVoucher.create({
                        data: {
                            id: generateShortId("bv"),
                            bookingId: booking.id,
                            voucherId: input.voucherId,
                            discountAmount: day.voucherDiscountAmount,
                            platformShare: split.platformShare,
                            partnerShare: split.partnerShare
                        }
                    });
                }
            }
            const payment = await tx.payment.create({
                data: {
                    bookingId: bookings[0].id,
                    bookingOrderId: orderId,
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
            return { conflict: false, orderId, bookings, payment };
        }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 });
    },
    createPayAtCourtOrderCheckout(input) {
        return prisma.$transaction(async (tx) => {
            for (const day of input.days) {
                const conflicts = await this.findConflictsInTransaction(tx, input.courtId, day.bookingDate, day.slots);
                if (conflicts.some(Boolean))
                    return { conflict: true, conflictDate: day.bookingDate };
            }
            const orderId = generateShortId("bo");
            const totalAmount = input.days.reduce((sum, day) => sum + day.totalAmount, 0);
            const subtotal = input.days.reduce((sum, day) => sum + day.subtotal, 0);
            const voucherDiscountAmount = input.days.reduce((sum, day) => sum + day.voucherDiscountAmount, 0);
            await tx.bookingOrder.create({
                data: {
                    id: orderId,
                    userId: input.userId,
                    courtId: input.courtId,
                    subtotal,
                    voucherDiscountAmount,
                    totalAmount,
                    paymentType: "PAY_AT_COURT",
                    status: "PENDING",
                    note: input.note
                }
            });
            if (input.voucherId && voucherDiscountAmount > 0) {
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
                await tx.userVoucher.updateMany({
                    where: { userId: input.userId, voucherId: input.voucherId, status: "CLAIMED" },
                    data: { status: "USED", usedAt: new Date() }
                });
            }
            const bookings = [];
            for (const day of input.days) {
                const sortedSlots = [...day.slots].sort((left, right) => left.startTime.localeCompare(right.startTime));
                const firstSlot = sortedSlots[0];
                const lastSlot = sortedSlots[sortedSlots.length - 1];
                const primarySurfaceId = firstSlot.courtSurfaceId || firstSlot.court_surface_id || firstSlot.courtSubId || null;
                const bookingId = generateShortId("bk");
                for (const service of day.services) {
                    if (service.serviceId && service.quantity > 0) {
                        const inv = await tx.serviceInventory.findFirst({
                            where: { serviceId: service.serviceId }
                        });
                        if (inv) {
                            if (inv.quantity < service.quantity) {
                                const svc = await tx.service.findUnique({ where: { id: service.serviceId } });
                                throw new ValidationError(`Sản phẩm/dịch vụ "${svc?.name || "Sản phẩm"}" chỉ còn ${inv.quantity} sản phẩm trong kho.`);
                            }
                            await tx.serviceInventory.update({
                                where: { id: inv.id },
                                data: { quantity: { decrement: service.quantity } }
                            });
                            await tx.inventoryTransaction.create({
                                data: {
                                    serviceId: service.serviceId,
                                    type: "RENTAL_OUT",
                                    quantity: service.quantity,
                                    unitCost: inv.lastPurchasePrice,
                                    referenceType: "BOOKING",
                                    referenceId: bookingId,
                                    note: `Đặt cùng đơn booking ${bookingId}`
                                }
                            });
                        }
                    }
                }
                const booking = await tx.booking.create({
                    data: {
                        id: bookingId,
                        bookingCode: day.bookingCode,
                        userId: input.userId,
                        courtId: input.courtId,
                        courtSurfaceId: primarySurfaceId,
                        bookingOrderId: orderId,
                        bookingDate: toDbDate(day.bookingDate),
                        startTime: timeToDate(firstSlot.startTime),
                        endTime: timeToDate(lastSlot.endTime),
                        basePrice: day.courtSubtotal,
                        dynamicAdjustmentAmount: 0,
                        subtotal: day.subtotal,
                        voucherDiscountAmount: day.voucherDiscountAmount,
                        totalPrice: day.totalAmount,
                        depositAmount: 0,
                        paymentMethod: "CASH",
                        paymentStatus: "UNPAID",
                        bookingStatus: "CONFIRMED",
                        note: input.note,
                        bookingSlots: {
                            create: sortedSlots.map((slot) => ({
                                courtId: input.courtId,
                                court_surface_id: slot.courtSurfaceId || slot.court_surface_id || slot.courtSubId || primarySurfaceId,
                                bookingDate: toDbDate(day.bookingDate),
                                startTime: timeToDate(slot.startTime),
                                endTime: timeToDate(slot.endTime),
                                slotPrice: slot.finalPrice ?? slot.price
                            }))
                        },
                        bookingServices: {
                            create: day.services.map((service) => ({
                                id: generateShortId("bs"),
                                serviceId: service.serviceId,
                                quantity: service.quantity,
                                price: service.price
                            }))
                        }
                    },
                    include: { court: true, bookingSlots: true, bookingServices: { include: { service: true } } }
                });
                bookings.push(booking);
                if (input.voucherId && day.voucherDiscountAmount > 0) {
                    const split = await voucherDiscountSplit(tx, input.voucherId, day.voucherDiscountAmount);
                    await tx.bookingVoucher.create({
                        data: {
                            id: generateShortId("bv"),
                            bookingId: booking.id,
                            voucherId: input.voucherId,
                            discountAmount: day.voucherDiscountAmount,
                            platformShare: split.platformShare,
                            partnerShare: split.partnerShare
                        }
                    });
                }
            }
            return { conflict: false, orderId, bookings };
        }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 });
    },
    toDbDate
};
