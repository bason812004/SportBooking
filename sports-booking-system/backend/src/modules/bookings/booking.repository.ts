import type { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { toDbDate } from "../../shared/utils/time.js";

export const bookingRepository = {
  findById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        court: { include: { images: true, category: true, partner: true } },
        bookingServices: { include: { service: true } },
        review: true
      }
    });
  },

  listByUser(userId: string, page: number, limit: number) {
    const where: Prisma.BookingWhereInput = { userId };
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

  create(data: Prisma.BookingCreateInput) {
    return prisma.booking.create({
      data,
      include: { court: true, bookingServices: { include: { service: true } } }
    });
  },

  cancel(id: string, cancelReason?: string) {
    return prisma.booking.update({
      where: { id },
      data: { bookingStatus: "CANCELLED", cancelReason },
      include: { court: true }
    });
  },

  courtWithPricing(id: string) {
    return prisma.court.findFirst({
      where: { id, approvalStatus: "APPROVED", activeStatus: "ACTIVE" },
      include: { prices: true, services: true }
    });
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
    paymentMethod: PaymentMethod;
    voucherId?: string;
    demandPredictionSnapshot?: Prisma.InputJsonValue;
    services: Array<{ serviceId: string; quantity: number; price: number }>;
  }) {
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
          demandPredictionSnapshot: input.demandPredictionSnapshot,
          totalPrice: input.totalPrice,
          paymentMethod: input.paymentMethod,
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
          data: { bookingId: booking.id, voucherId: input.voucherId, discountAmount: input.voucherDiscountAmount }
        });
        await tx.voucher.update({ where: { id: input.voucherId }, data: { usedCount: { increment: 1 } } });
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
