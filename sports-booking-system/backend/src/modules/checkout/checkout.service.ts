import { prisma } from "../../config/db.js";
import { checkoutAccessRepository, type CheckoutActor } from "./checkout.access.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { checkoutRepository } from "./checkout.repository.js";
import type { ProcessCheckoutPaymentInput } from "./checkout.types.js";

export const checkoutService = {
  async getOrCreateCheckout(bookingId: string, actor: CheckoutActor) {
    await checkoutAccessRepository.assertBooking(bookingId, actor);
    const data = await checkoutRepository.getOrCreateCheckout(bookingId);
    return data;
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
