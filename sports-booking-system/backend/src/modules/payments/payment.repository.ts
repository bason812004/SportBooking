import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { settlementService } from "../settlements/settlement.service.js";

const webhookBookingInclude = {
  booking: {
    include: {
      court: {
        include: { partner: { select: { id: true, commissionRate: true } } }
      }
    }
  },
  bookingOrder: {
    include: {
      bookings: {
        include: {
          court: {
            include: { partner: { select: { id: true, commissionRate: true } } }
          }
        }
      }
    }
  }
} as const;

export const paymentRepository = {
  findForUser(paymentId: string, userId: string) {
    return prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: {
        booking: {
          include: {
            court: { include: { images: { orderBy: { sortOrder: "asc" } }, category: true } },
            bookingSlots: { orderBy: { startTime: "asc" } }
          }
        }
      }
    });
  },

  findByExternalOrderId(externalOrderId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.payment.findUnique({ where: { externalOrderId }, include: webhookBookingInclude });
  },

  findTransaction(provider: string, providerTransactionId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.paymentTransaction.findUnique({
      where: { provider_providerTransactionId: { provider, providerTransactionId } }
    });
  },

  async applyWebhook(input: {
    provider: string;
    externalOrderId: string;
    externalTransactionId: string;
    status: "PAID" | "FAILED" | "EXPIRED";
    amount: number;
    rawPayload: Prisma.InputJsonValue;
    paymentReference?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      let payment = null;
      if (input.externalOrderId) {
        payment = await this.findByExternalOrderId(input.externalOrderId, tx);
      }
      if (!payment && input.paymentReference) {
        payment = await tx.payment.findFirst({
          where: { paymentReference: input.paymentReference },
          include: webhookBookingInclude
        });
      }
      if (!payment && input.externalOrderId) {
        payment = await tx.payment.findFirst({
          where: {
            OR: [
              { paymentReference: input.externalOrderId },
              { externalOrderId: { startsWith: input.externalOrderId } }
            ]
          },
          include: webhookBookingInclude
        });
      }
      if (!payment) {
        console.log(`[applyWebhook] Payment not found for externalOrderId: "${input.externalOrderId}", reference: "${input.paymentReference}"`);
        return null;
      }

      const existingTransaction = await this.findTransaction(input.provider, input.externalTransactionId, tx);
      if (existingTransaction) {
        console.log(`[applyWebhook] Transaction already processed (idempotent): provider=${input.provider}, txId=${input.externalTransactionId}`);
        return { payment, idempotent: true };
      }

      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          provider: input.provider,
          providerTransactionId: input.externalTransactionId,
          providerStatus: input.status,
          amount: input.amount,
          rawPayloadJson: input.rawPayload,
          verified: true
        }
      });

      const paid = input.status === "PAID" && Number(payment.amount) === input.amount;
      console.log(`[applyWebhook] Match result: paid=${paid}. Expected: amount=${payment.amount}, status="PAID". Received: amount=${input.amount}, status="${input.status}"`);
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: paid ? "PAID" : "FAILED",
          externalTransactionId: input.externalTransactionId,
          paidAt: paid ? new Date() : undefined
        },
        include: webhookBookingInclude
      });

      const orderBookings = updatedPayment.bookingOrder?.bookings;
      const bookingsToSettle = orderBookings && orderBookings.length > 0 ? orderBookings : [updatedPayment.booking];

      await tx.booking.updateMany({
        where: { id: { in: bookingsToSettle.map((b) => b.id) } },
        data: {
          bookingStatus: paid ? "CONFIRMED" : "CANCELLED",
          paymentStatus: paid ? "PAID" : "FAILED"
        }
      });

      const settlements = [];
      for (const booking of bookingsToSettle) {
        const settlement = paid
          ? await settlementService.createFromPaidBooking(booking, updatedPayment.id, tx)
          : await settlementService.cancelForBooking(booking.id, tx);
        if (settlement) settlements.push(settlement);
      }

      return { payment: updatedPayment, idempotent: false, settlement: settlements[0] ?? null, settlements, bookings: bookingsToSettle };
    });
  },

  expirePendingPayment(paymentId: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { bookingOrder: { include: { bookings: true } } }
      });
      if (!payment || (payment.status !== "PENDING" && payment.status !== "UNPAID") || payment.expiresAt.getTime() > Date.now()) return payment;
      const bookingIds = payment.bookingOrder?.bookings.length
        ? payment.bookingOrder.bookings.map((b) => b.id)
        : [payment.bookingId];
      await tx.booking.updateMany({
        where: { id: { in: bookingIds } },
        data: { bookingStatus: "CANCELLED", paymentStatus: "EXPIRED" }
      });
      return tx.payment.update({ where: { id: paymentId }, data: { status: "EXPIRED" } });
    });
  }
};
