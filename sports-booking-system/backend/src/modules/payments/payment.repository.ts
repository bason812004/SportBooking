import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

async function createSettlementFromPayment(tx: Prisma.TransactionClient, bookingId: string, paymentId: string) {
  const existing = await tx.settlement.findUnique({ where: { bookingId } });
  if (existing) return existing;

  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      court: { include: { partner: true } },
      bookingServices: { include: { service: true } },
      bookingSlots: true,
      bookingVoucher: { include: { voucher: true } }
    }
  });
  if (!booking) return null;
  if (booking.paymentStatus !== "PAID") return null;

  const partnerId = booking.court.partnerId;
  const partnerRate = booking.court.partner.commissionRate;
  const defaultRate = 10;
  const commissionRate = partnerRate !== null ? toNum(partnerRate) : defaultRate;

  const slotTotal = booking.bookingSlots.reduce((sum, slot) => sum + toNum(slot.slotPrice), 0);
  const serviceTotal = booking.bookingServices.reduce((sum, bs) => sum + toNum(bs.price) * bs.quantity, 0);
  const grossAmount = Math.round((slotTotal + serviceTotal) * 100) / 100;
  const voucherDiscount = toNum(booking.voucherDiscountAmount);

  // Split voucher discount between platform and partner based on
  // funding rules. voucher.partnerFundingPercent / platformFundingPercent
  // are taken from the voucher row (default 100/0 for PARTNER, 0/100 for
  // PLATFORM, or whatever SHARE was set to).
  let partnerDiscount = 0;
  let platformDiscount = 0;
  if (booking.bookingVoucher) {
    const partnerPct = toNum(booking.bookingVoucher.partnerShare && booking.bookingVoucher.voucher.partnerFundingPercent);
    const platformPct = toNum(booking.bookingVoucher.voucher.platformFundingPercent);
    const pfPct = booking.bookingVoucher.voucher.partnerFundingPercent != null
      ? toNum(booking.bookingVoucher.voucher.partnerFundingPercent)
      : 100;
    const plPct = booking.bookingVoucher.voucher.platformFundingPercent != null
      ? toNum(booking.bookingVoucher.voucher.platformFundingPercent)
      : 0;
    partnerDiscount = Math.round((voucherDiscount * pfPct) / 100);
    platformDiscount = Math.max(0, Math.round(voucherDiscount - partnerDiscount));
    // enforce non-negative sanity even if both percents zero
    if (pfPct + plPct === 0) platformDiscount = voucherDiscount;
    void partnerPct; void platformPct;
  } else {
    partnerDiscount = voucherDiscount;
  }

  const commissionAmount = Math.round(grossAmount * (commissionRate / 100) * 100) / 100;

  // Net to partner = (gross - partner's share of voucher) - commission.
  // The platform absorbs its share of the voucher discount on top of the
  // commission it already keeps.
  const netAmount = Math.max(
    0,
    Math.round(((grossAmount - partnerDiscount) - commissionAmount) * 100) / 100
  );

  const wallet = await tx.partnerWallet.findUnique({ where: { partnerId } });
  if (!wallet) {
    await tx.partnerWallet.create({
      data: { partnerId, availableBalance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0, currency: "VND" }
    });
  }

  await tx.partnerWallet.update({
    where: { partnerId },
    data: { pendingBalance: { increment: netAmount }, totalEarned: { increment: netAmount } }
  });

  return tx.settlement.create({
    data: {
      bookingId,
      partnerId,
      paymentId,
      grossAmount,
      voucherDiscount,
      platformDiscount,
      partnerDiscount,
      commissionAmount,
      serviceFee: 0,
      netAmount,
      status: "PENDING"
    }
  });
}

/**
 * Once the payment is confirmed PAID, finalize the voucher accounting
 * for this booking. Idempotent (no-op if BookingVoucher already exists).
 * Returns true if the booking had a voucher and we finalized it.
 */
async function finalizeVoucherOnPayment(tx: Prisma.TransactionClient, bookingId: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: { bookingVoucher: { include: { voucher: true } } }
  });
  if (!booking) return false;
  if (!booking.bookingVoucher) return false;

  const voucherRow = booking.bookingVoucher;
  // Increment used_count, guarded by usage_limit
  const updated = await tx.$executeRaw`
    update vouchers
    set used_count = used_count + 1,
        updated_at = now()
    where id = ${voucherRow.voucherId}
      and status = 'ACTIVE'::voucher_status
      and (usage_limit is null or used_count < usage_limit)
  `;
  if (updated === 0) {
    // Either disabled or out of quota - leave accounting as-is but don't crash.
    return false;
  }

  // Mark user_voucher as USED
  await tx.$executeRaw`
    update user_vouchers
    set status = 'USED'::user_voucher_status,
        used_at = coalesce(used_at, now())
    where user_id = ${booking.userId}
      and voucher_id = ${voucherRow.voucherId}
      and status = 'CLAIMED'::user_voucher_status
  `;

  return true;
}

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

      if (paid) {
        await finalizeVoucherOnPayment(tx, payment.bookingId);
        await createSettlementFromPayment(tx, payment.bookingId, payment.id);
      }

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
