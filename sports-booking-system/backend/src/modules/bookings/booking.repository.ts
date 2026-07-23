import type { PaymentMethod, PaymentType, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ValidationError } from "../../shared/errors/AppError.js";
import { timeToDate, toDbDate } from "../../shared/utils/time.js";

function generateShortId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36).slice(-8);
  return `${prefix}${rand}${time}`.slice(0, 20);
}

let depositColumnReady = false;

async function ensureCourtDepositColumn() {
  if (depositColumnReady) return;
  await prisma.$executeRaw`
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
async function voucherDiscountSplit(
  tx: Prisma.TransactionClient,
  voucherId: string,
  discountAmount: number
): Promise<{ partnerShare: number; platformShare: number }> {
  const row = await tx.voucher.findUnique({
    where: { id: voucherId },
    select: {
      fundedBy: true,
      partnerFundingPercent: true,
      platformFundingPercent: true
    }
  });
  if (!row) return { partnerShare: discountAmount, platformShare: 0 };
  const funded = (row.fundedBy ?? "PARTNER") as string;
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
  findById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        court: { include: { images: { orderBy: { sortOrder: "asc" } }, category: true, partner: true } },
        bookingServices: { include: { service: true } },
        bookingVoucher: { include: { voucher: { include: { partner: true, court: true } } } },
        payments: { orderBy: { createdAt: "desc" } },
        bookingOrder: { select: { payment: true } },
        review: true
      }
    });
  },

  listByUser(userId: string, page: number, limit: number) {
    const where: Prisma.BookingWhereInput = { userId };
    return prisma.$transaction([
      prisma.booking.findMany({
        where,
        include: {
          court: { include: { images: { orderBy: { sortOrder: "asc" } }, category: true, partner: true } },
          bookingServices: { include: { service: true } },
          bookingVoucher: { include: { voucher: true } },
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

  create(data: Prisma.BookingCreateInput) {
    return prisma.booking.create({
      data,
      include: { court: true, bookingServices: { include: { service: true } } }
    });
  },

  cancel(
    id: string,
    data: {
      cancelReason?: string;
      refundAmount: number;
      platformRetainedAmount: number;
      paymentStatus: PaymentStatus;
    },
    db: Prisma.TransactionClient | typeof prisma = prisma
  ) {
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

  courtWithPricing(id: string) {
    return prisma.court.findFirst({
      where: { id, approvalStatus: "APPROVED", activeStatus: "ACTIVE" },
      include: { prices: true, services: true, images: { orderBy: { sortOrder: "asc" } } }
    });
  },

  async courtDepositPercent(id: string) {
    await ensureCourtDepositColumn();
    const [row] = await prisma.$queryRaw<Array<{ depositPercent: number | null }>>`
      select deposit_percent::float as "depositPercent"
      from courts
      where id = ${id}
      limit 1
    `;
    return Number(row?.depositPercent ?? 0);
  },

  services(ids: string[]) {
    return prisma.courtService.findMany({ where: { id: { in: ids }, status: "ACTIVE" } });
  },

  createWithServices(input: {
    bookingCode: string;
    userId: string;
    courtId: string;
    bookingDate: Date;
    startTime: Date;
    endTime: Date;
    basePrice: number;
    dynamicAdjustmentAmount: number;
    subtotal: number;
    voucherDiscountAmount: number;
    totalPrice: number;
    depositAmount: number;
    paymentMethod: PaymentMethod;
    voucherId?: string;
    note?: string;
    demandPredictionSnapshot?: Prisma.InputJsonValue | null;
    services: Array<{ serviceId: string; quantity: number; price: number }>;
  }) {
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

  async findConflictsInTransaction(
    tx: Prisma.TransactionClient,
    courtId: string,
    date: string,
    slots: Array<{ startTime: string; endTime: string }>
  ) {
    const activeStatuses = ["PENDING", "PENDING_PAYMENT", "CONFIRMED", "COMPLETED"];
    const bookingDate = toDbDate(date);
    const conflicts: Array<unknown> = [];

    for (const slot of slots) {
      const startTime = timeToDate(slot.startTime.slice(0, 5));
      const endTime = timeToDate(slot.endTime.slice(0, 5));
      const legacyBooking = await tx.booking.findFirst({
        where: {
          courtId,
          bookingDate,
          bookingStatus: { in: activeStatuses as any },
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
          booking: { bookingStatus: { in: activeStatuses as any } }
        }
      });
      conflicts.push(slotBooking);
    }

    return conflicts;
  },

  createCheckout(input: {
    bookingCode: string;
    userId: string;
    courtId: string;
    bookingDate: string;
    slots: Array<{ startTime: string; endTime: string; price: number }>;
    services: Array<{ serviceId: string; quantity: number; price: number }>;
    courtSubtotal: number;
    subtotal: number;
    voucherDiscountAmount: number;
    totalAmount: number;
    depositAmount: number;
    paymentType: PaymentType;
    paymentAmount: number;
    voucherId?: string;
    note?: string;
    provider: string;
    externalOrderId: string;
    qrCodeUrl: string | null;
    qrPayload: string | null;
    paymentReference: string;
    expiresAt: Date;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const conflicts = await this.findConflictsInTransaction(tx, input.courtId, input.bookingDate, input.slots);
        if (conflicts.some(Boolean)) return { conflict: true as const };

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

        return { conflict: false as const, booking, payment };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }
    );
  },

  createPayAtCourtCheckout(input: {
    bookingCode: string;
    userId: string;
    courtId: string;
    bookingDate: string;
    slots: Array<{ startTime: string; endTime: string; price: number }>;
    services: Array<{ serviceId: string; quantity: number; price: number }>;
    courtSubtotal: number;
    subtotal: number;
    voucherDiscountAmount: number;
    totalAmount: number;
    voucherId?: string;
    note?: string;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const conflicts = await this.findConflictsInTransaction(tx, input.courtId, input.bookingDate, input.slots);
        if (conflicts.some(Boolean)) return { conflict: true as const };

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

        return { conflict: false as const, booking };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }
    );
  },

  createOrderCheckout(input: {
    userId: string;
    courtId: string;
    days: Array<{
      bookingCode: string;
      bookingDate: string;
      slots: Array<{ startTime: string; endTime: string; price: number }>;
      services: Array<{ serviceId: string; quantity: number; price: number }>;
      courtSubtotal: number;
      subtotal: number;
      voucherDiscountAmount: number;
      totalAmount: number;
    }>;
    subtotal: number;
    voucherDiscountAmount: number;
    totalAmount: number;
    paymentType: PaymentType;
    paymentAmount: number;
    voucherId?: string;
    note?: string;
    provider: string;
    externalOrderId: string;
    qrCodeUrl: string | null;
    qrPayload: string | null;
    paymentReference: string;
    expiresAt: Date;
  }) {
    return prisma.$transaction(
      async (tx) => {
        for (const day of input.days) {
          const conflicts = await this.findConflictsInTransaction(tx, input.courtId, day.bookingDate, day.slots);
          if (conflicts.some(Boolean)) return { conflict: true as const, conflictDate: day.bookingDate };
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
          const bookingId = generateShortId("bk");
          const booking = await tx.booking.create({
            data: {
              id: bookingId,
              bookingCode: day.bookingCode,
              userId: input.userId,
              courtId: input.courtId,
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
                  bookingDate: toDbDate(day.bookingDate),
                  startTime: timeToDate(slot.startTime),
                  endTime: timeToDate(slot.endTime),
                  slotPrice: slot.price
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

        return { conflict: false as const, orderId, bookings, payment };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }
    );
  },

  createPayAtCourtOrderCheckout(input: {
    userId: string;
    courtId: string;
    days: Array<{
      bookingCode: string;
      bookingDate: string;
      slots: Array<{ startTime: string; endTime: string; price: number }>;
      services: Array<{ serviceId: string; quantity: number; price: number }>;
      courtSubtotal: number;
      subtotal: number;
      voucherDiscountAmount: number;
      totalAmount: number;
    }>;
    voucherId?: string;
    note?: string;
  }) {
    return prisma.$transaction(
      async (tx) => {
        for (const day of input.days) {
          const conflicts = await this.findConflictsInTransaction(tx, input.courtId, day.bookingDate, day.slots);
          if (conflicts.some(Boolean)) return { conflict: true as const, conflictDate: day.bookingDate };
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
          const bookingId = generateShortId("bk");
          const booking = await tx.booking.create({
            data: {
              id: bookingId,
              bookingCode: day.bookingCode,
              userId: input.userId,
              courtId: input.courtId,
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
                  bookingDate: toDbDate(day.bookingDate),
                  startTime: timeToDate(slot.startTime),
                  endTime: timeToDate(slot.endTime),
                  slotPrice: slot.price
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

        return { conflict: false as const, orderId, bookings };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }
    );
  },

  toDbDate
};
