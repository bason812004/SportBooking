import { env } from "../../config/env.js";
import { ForbiddenError, NotFoundError } from "../../shared/errors/AppError.js";
import { notificationService } from "../notifications/notification.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { paymentRepository } from "./payment.repository.js";
import { paymentProvider } from "./providers/index.js";

function notifyPaymentResult(result: Awaited<ReturnType<typeof paymentRepository.applyWebhook>>) {
  if (!result) return;
  const payment = result.payment;
  const paymentEvent = payment.status === "PAID" ? realtimeEvents.paymentPaid : realtimeEvents.paymentFailed;
  realtimeService.toUser(payment.userId, paymentEvent, payment);
  realtimeService.toCourt(payment.booking.courtId, realtimeEvents.courtAvailabilityUpdated, { courtId: payment.booking.courtId });
  if ("bookings" in result && result.bookings) {
    for (const booking of result.bookings) {
      realtimeService.toBooking(booking.id, paymentEvent, payment);
    }
  } else {
    realtimeService.toBooking(payment.bookingId, paymentEvent, payment);
  }
  if ("settlements" in result && result.settlements) {
    for (const settlement of result.settlements) {
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
    }
  }
}

// Money arrived after the booking expired; the booking stays cancelled, so the customer and the admins
// who issue refunds (PATCH /admin/bookings/:id/admin -> REFUNDED) both need to know.
async function notifyLatePaymentRefund(result: { payment: { id: string; userId: string }; bookings: Array<{ id: string; bookingCode: string }>; lateRefund: { amount: number } }) {
  const amount = `${new Intl.NumberFormat("vi-VN").format(result.lateRefund.amount)}đ`;
  const codes = result.bookings.map((booking) => booking.bookingCode).join(", ");
  const metadata = { paymentId: result.payment.id, bookingIds: result.bookings.map((booking) => booking.id), amount: result.lateRefund.amount };
  try {
    await notificationService.create({
      userId: result.payment.userId,
      title: "Thanh toán đến sau khi đơn đã hết hạn",
      content: `Đơn ${codes} đã bị hủy vì quá thời gian thanh toán, nên khoản ${amount} bạn vừa chuyển sẽ được hoàn lại.`,
      type: "PAYMENT_LATE_REFUND",
      metadata
    });
    await notificationService.notifyAdmins({
      title: "Cần hoàn tiền một khoản thanh toán trễ",
      content: `Khách đã chuyển ${amount} cho đơn ${codes} sau khi đơn hết hạn và đã bị hủy. Hãy hoàn tiền rồi cập nhật đơn sang Đã hoàn tiền.`,
      type: "PAYMENT_LATE_REFUND",
      metadata
    });
  } catch (error) {
    // The payment itself is already recorded; a failed notice must not fail the provider's webhook call.
    console.error("[PaymentLateRefund] Notification failed:", error);
  }
}

export const paymentService = {
  async detail(userId: string, paymentId: string) {
    const payment = await paymentRepository.findForUser(paymentId, userId);
    if (!payment) throw new NotFoundError("Khong tim thay thanh toan");
    if ((payment.status === "PENDING" || payment.status === "UNPAID") && payment.expiresAt.getTime() <= Date.now()) {
      await paymentRepository.expirePendingPayment(payment.id);
      const expiredPayment = await paymentRepository.findForUser(paymentId, userId);
      if (!expiredPayment) throw new NotFoundError("Khong tim thay thanh toan");
      return expiredPayment;
    }
    return payment;
  },

  async status(userId: string, paymentId: string) {
    const payment = await this.detail(userId, paymentId);
    return {
      id: payment.id,
      bookingId: payment.bookingId,
      status: payment.status,
      bookingStatus: payment.booking.bookingStatus,
      amount: Number(payment.amount),
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt
    };
  },

  async webhook(provider: string, payload: unknown, headers: Record<string, string | string[] | undefined>) {
    if (!provider || provider.toUpperCase() !== env.PAYMENT_PROVIDER.toUpperCase()) throw new ForbiddenError("Provider thanh toán không hợp lệ");
    const verified = await paymentProvider.verifyWebhook(payload, headers);
    if (verified.verificationOnly) return { ok: true, verification: true };
    const result = await paymentRepository.applyWebhook({
      ...verified,
      rawPayload: verified.rawPayload as any
    });
    if (!result) throw new NotFoundError("Khong tim thay giao dich thanh toan");
    notifyPaymentResult(result);
    if ("lateRefund" in result && result.lateRefund) await notifyLatePaymentRefund(result);
    return { ok: true, idempotent: result.idempotent };
  },

  // Dev-only shortcut so QA/testers can complete a booking payment without scanning a real QR
  // code. Disabled outside development so it can never be used to fake a payment in production.
  async devMarkPaid(userId: string, paymentId: string) {
    if (env.NODE_ENV === "production") {
      throw new ForbiddenError("Chuc nang nay khong kha dung o moi truong production");
    }
    const payment = await paymentRepository.findForUser(paymentId, userId);
    if (!payment) throw new NotFoundError("Khong tim thay thanh toan");
    if (payment.status !== "PENDING" && payment.status !== "UNPAID") {
      return { ok: true, idempotent: true };
    }

    const result = await paymentRepository.applyWebhook({
      provider: "DEV_TEST",
      externalOrderId: payment.externalOrderId ?? payment.paymentReference,
      externalTransactionId: `DEV_${Date.now()}`,
      status: "PAID",
      amount: Number(payment.amount),
      rawPayload: { dev: true, markedBy: userId } as any,
      paymentReference: payment.paymentReference
    });
    if (!result) throw new NotFoundError("Khong tim thay giao dich thanh toan");
    notifyPaymentResult(result);
    return { ok: true, idempotent: result.idempotent };
  }
};
