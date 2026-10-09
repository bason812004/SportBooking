import { prisma } from "../../config/db.js";
import { checkoutAccessRepository, type CheckoutActor } from "./checkout.access.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { checkoutRepository } from "./checkout.repository.js";
import type { ProcessCheckoutPaymentInput } from "./checkout.types.js";

export const checkoutService = {
  async getOrCreateCheckout(bookingId: string, actor: CheckoutActor) {
    await checkoutAccessRepository.assertBooking(bookingId, actor);
    const data = await checkoutRepository.getOrCreateCheckout(bookingId);
    const partner = data.booking.court.partner;
    const paymentReference = `SPPAY${data.booking.bookingCode.replace(/[^A-Z0-9]/gi, "")}`;
    const bankTransfer = partner?.bankName && partner.bankAccountNumber ? {
      bankName: partner.bankName,
      accountNumber: partner.bankAccountNumber,
      accountHolder: partner.bankAccountHolder,
      paymentReference,
      // Free-text bank names may not be VietQR identifiers; show manual details in that case.
      qrCodeUrl: /^[a-z0-9]+$/i.test(partner.bankName) && /^\d+$/.test(partner.bankAccountNumber)
        ? `https://img.vietqr.io/image/${encodeURIComponent(partner.bankName)}-${encodeURIComponent(partner.bankAccountNumber)}-compact.jpg?amount=${data.breakdown.remainingAmount}&addInfo=${encodeURIComponent(paymentReference)}`
        : null
    } : null;
    return { ...data, bankTransfer };
  },

  async processPayment(input: ProcessCheckoutPaymentInput, actor: CheckoutActor) {
    await checkoutAccessRepository.assertCheckout(input.checkoutId, actor);
    const data = await checkoutRepository.processPayment(input);
    const bookingId = data.checkout.bookingId;

    realtimeService.toBooking(bookingId, "booking:payment-completed", {
      bookingId,
      checkoutId: data.checkout.id,
      amountPaid: input.amount,
      remainingAmount: data.checkout.remainingAmount,
      isCompleted: data.isCompleted
    });

    if (data.isCompleted) {
      realtimeService.toBooking(bookingId, "booking:status-changed", {
        bookingId,
        status: "COMPLETED"
      });
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { courtId: true } });
    if (booking?.courtId) {
      realtimeService.toCourt(booking.courtId, "court:booking-updated", {
        bookingId,
        isCompleted: data.isCompleted,
        status: data.isCompleted ? "COMPLETED" : "CHECKOUT_PENDING"
      });
    }

    return data;
  },

  async listCheckouts(partnerId: string) {
    return checkoutRepository.listCheckouts(partnerId);
  }
};
