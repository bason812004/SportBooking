import { ForbiddenError, NotFoundError } from "../../shared/errors/AppError.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { paymentRepository } from "./payment.repository.js";
import { paymentProvider } from "./providers/index.js";

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
    if (!provider) throw new ForbiddenError("Provider thanh toan khong hop le");
    const verified = await paymentProvider.verifyWebhook(payload, headers);
    const result = await paymentRepository.applyWebhook({
      ...verified,
      rawPayload: verified.rawPayload as any
    });
    if (!result) throw new NotFoundError("Khong tim thay giao dich thanh toan");

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
    return { ok: true, idempotent: result.idempotent };
  }
};
