import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

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
    return tx.payment.findUnique({ where: { externalOrderId }, include: { booking: { include: { court: true } } } });
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
          include: { booking: { include: { court: true } } }
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
          include: { booking: { include: { court: true } } }
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
        include: { booking: { include: { court: true } } }
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          bookingStatus: paid ? "CONFIRMED" : "CANCELLED",
          paymentStatus: paid ? "PAID" : "FAILED"
        }
      });

      return { payment: updatedPayment, idempotent: false };
    });
  },

  expirePendingPayment(paymentId: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || (payment.status !== "PENDING" && payment.status !== "UNPAID") || payment.expiresAt.getTime() > Date.now()) return payment;
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { bookingStatus: "CANCELLED", paymentStatus: "EXPIRED" }
      });
      return tx.payment.update({ where: { id: paymentId }, data: { status: "EXPIRED" } });
    });
  }
};
