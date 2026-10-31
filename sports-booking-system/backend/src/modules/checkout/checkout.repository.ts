import type { Prisma } from "@prisma/client";
import { settlementService } from "../settlements/settlement.service.js";
import { checkoutBreakdown } from "./checkout.calculations.js";
import { prisma } from "../../config/db.js";
import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { ensureServiceTables } from "../services/service.repository.js";
import type { ProcessCheckoutPaymentInput } from "./checkout.types.js";

// Supabase nằm ở xa nên mỗi round-trip tốn hàng trăm ms; các transaction ở đây có 5-7 round-trip
// tuần tự nên timeout mặc định 5000ms của Prisma là quá chặt và gây P2028 ("Transaction already closed").
const CHECKOUT_TX_OPTIONS = {
  isolationLevel: "Serializable",
  maxWait: 10_000,
  timeout: 20_000
} as const;

export const checkoutRepository = {
  async getOrCreateCheckout(bookingId: string, client?: Prisma.TransactionClient) {
    if (!client) await ensureServiceTables();
    const run = async (tx: Prisma.TransactionClient) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          bookingServices: { where: { OR: [{ status: "ACTIVE" }, { status: null }] }, include: { service: true } },
          payments: { where: { status: "PAID" } },
          user: { select: { id: true, fullName: true, phone: true, email: true } },
          court: { select: { id: true, name: true, address: true, partnerId: true, partner: { select: { bankName: true, bankAccountNumber: true, bankAccountHolder: true } } } }
        }
      });

      if (!booking) throw new NotFoundError("Booking không tồn tại");

      const {
        subtotalCourt: courtSubtotal,
        subtotalService: serviceSubtotal,
        discount: voucherDiscount,
        totalAmount: grandTotal,
        depositPaid
      } = checkoutBreakdown(booking, booking.bookingServices);

      let checkout = await tx.checkout.findUnique({
        where: { bookingId },
        include: { payments: true }
      });

      const wasCompleted = checkout?.status === "COMPLETED";
      if (!checkout) {
        const remainingAmount = Math.max(0, grandTotal - depositPaid);
        checkout = await tx.checkout.create({
          data: {
            bookingId,
            subtotalCourt: courtSubtotal,
            subtotalService: serviceSubtotal,
            discount: voucherDiscount,
            depositPaid,
            amountPaid: depositPaid,
            remainingAmount,
            totalAmount: grandTotal,
            status: remainingAmount === 0 ? "COMPLETED" : "PENDING"
          },
          include: { payments: true }
        });
      } else {
        // Recalculate totals
        const additionalPayments = checkout.payments
          .filter((p) => p.status === "PAID")
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const totalPaidSoFar = depositPaid + additionalPayments;
        const remainingAmount = Math.max(0, grandTotal - totalPaidSoFar);
        const status = remainingAmount === 0 ? "COMPLETED" : "PENDING";

        checkout = await tx.checkout.update({
          where: { id: checkout.id },
          data: {
            subtotalCourt: courtSubtotal,
            subtotalService: serviceSubtotal,
            discount: voucherDiscount,
            depositPaid,
            amountPaid: totalPaidSoFar,
            remainingAmount,
            totalAmount: grandTotal,
            status
          },
          include: { payments: true }
        });
      }

      if (Number(checkout.remainingAmount) > 0 && (wasCompleted || booking.bookingStatus === "COMPLETED")) {
        await tx.booking.update({ where: { id: bookingId }, data: { bookingStatus: "CHECKOUT_PENDING", paymentStatus: "PENDING" } });
        booking.bookingStatus = "CHECKOUT_PENDING";
        booking.paymentStatus = "PENDING";
      }

      return {
        checkout,
        booking,
        breakdown: {
          subtotalCourt: courtSubtotal,
          subtotalService: serviceSubtotal,
          discount: voucherDiscount,
          depositPaid,
          totalPaid: Number(checkout.amountPaid),
          remainingAmount: Number(checkout.remainingAmount),
          totalAmount: grandTotal,
          isFullyPaid: Number(checkout.remainingAmount) <= 0
        }
      };
    };
    return client ? run(client) : prisma.$transaction(run, CHECKOUT_TX_OPTIONS);
  },

  async processPayment(input: ProcessCheckoutPaymentInput) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      let checkout = await tx.checkout.findUnique({
        where: { id: input.checkoutId },
        include: { booking: true, payments: true }
      });

      if (!checkout) throw new NotFoundError("Thông tin checkout không tồn tại");
      checkout = { ...checkout, ...(await this.getOrCreateCheckout(checkout.bookingId, tx)).checkout };
      if (Number(checkout.remainingAmount) <= 0) {
        throw new ValidationError("Đơn hàng này đã được thanh toán hoàn tất");
      }

      const payAmount = Number(input.amount);
      if (!Number.isFinite(payAmount) || payAmount <= 0) throw new ValidationError("Số tiền thanh toán phải lớn hơn 0");

      if (payAmount > Number(checkout.remainingAmount)) throw new ValidationError("Số tiền vượt quá dư nợ hóa đơn");

      const paymentRecord = await tx.checkoutPayment.create({
        data: {
          checkoutId: checkout.id,
          amount: payAmount,
          paymentMethod: input.paymentMethod,
          transactionId: input.transactionId ?? `TX${Date.now()}`,
          status: "PAID",
          paidAt: new Date()
        }
      });

      const newAmountPaid = Number(checkout.amountPaid) + payAmount;
      const newRemaining = Math.max(0, Number(checkout.totalAmount) - newAmountPaid);
      const isCompleted = newRemaining <= 0;

      const updatedCheckout = await tx.checkout.update({
        where: { id: checkout.id },
        data: {
          amountPaid: newAmountPaid,
          remainingAmount: newRemaining,
          status: isCompleted ? "COMPLETED" : "PENDING"
        },
        include: { payments: true }
      });

      if (isCompleted) {
        await settlementService.settleForBooking(checkout.bookingId, tx);
        await settlementService.chargePartnerCollected(checkout.bookingId, tx);
        await tx.booking.update({
          where: { id: checkout.bookingId },
          data: {
            bookingStatus: "COMPLETED",
            paymentStatus: "PAID"
          }
        });
      } else {
        await tx.booking.update({
          where: { id: checkout.bookingId },
          data: {
            bookingStatus: "CHECKOUT_PENDING"
          }
        });
      }

      return {
        checkout: updatedCheckout,
        payment: paymentRecord,
        isCompleted
      };
    }, CHECKOUT_TX_OPTIONS);
  }
};
