import { realtimeService } from "../realtime/realtime.service.js";
import { checkoutRepository } from "./checkout.repository.js";
import type { ProcessCheckoutPaymentInput } from "./checkout.types.js";

export const checkoutService = {
  async getOrCreateCheckout(bookingId: string) {
    const data = await checkoutRepository.getOrCreateCheckout(bookingId);
    realtimeService.toBooking(bookingId, "booking:checkout-ready", {
      bookingId,
      checkout: data.checkout,
      breakdown: data.breakdown
    });
    return data;
  },

  async processPayment(input: ProcessCheckoutPaymentInput) {
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

    return data;
  },

  async listCheckouts(partnerId: string) {
    return checkoutRepository.listCheckouts(partnerId);
  }
};
