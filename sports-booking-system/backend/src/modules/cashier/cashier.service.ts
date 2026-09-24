import { checkoutAccessRepository, type CheckoutActor } from "../checkout/checkout.access.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { cashierRepository } from "./cashier.repository.js";
import type { AddServiceToBookingInput, ReturnRentalItemInput } from "./cashier.types.js";

export const cashierService = {
  async getActiveBookings(partnerId: string, courtId?: string, search?: string, filter?: string) {
    return cashierRepository.getActiveBookings(partnerId, courtId, search, filter);
  },

  async getBookingDetailForCashier(bookingId: string, actor: CheckoutActor) {
    await checkoutAccessRepository.assertBooking(bookingId, actor);
    return cashierRepository.getBookingDetailForCashier(bookingId);
  },

  async checkInBooking(bookingId: string, actor: CheckoutActor) {
    await checkoutAccessRepository.assertBooking(bookingId, actor, true);
    const updated = await cashierRepository.checkInBooking(bookingId);
    realtimeService.toBooking(bookingId, "booking:status-changed", {
      bookingId,
      status: "IN_PROGRESS"
    });
    if (updated.courtId) {
      realtimeService.toCourt(updated.courtId, "court:booking-updated", {
        bookingId,
        status: "IN_PROGRESS"
      });
    }
    return updated;
  },

  async addServiceToBooking(bookingId: string, input: AddServiceToBookingInput, addedBy: string, actor: CheckoutActor) {
    await checkoutAccessRepository.assertBooking(bookingId, actor);
    const result = await cashierRepository.addServiceToBooking(bookingId, input, addedBy);
    const detail = await cashierRepository.getBookingDetailForCashier(bookingId);

    realtimeService.toBooking(bookingId, "booking:checkout-ready", { bookingId });

    // Emit Realtime socket events to booking room
    realtimeService.toBooking(bookingId, "booking:service-added", {
      bookingId,
      addedService: result,
      totals: {
        courtSubtotal: detail.courtSubtotal,
        serviceSubtotal: detail.serviceSubtotal,
        voucherDiscount: detail.voucherDiscount,
        grandTotal: detail.grandTotal,
        remainingAmount: detail.remainingAmount
      }
    });

    realtimeService.toBooking(bookingId, "booking:total-updated", {
      bookingId,
      grandTotal: detail.grandTotal,
      remainingAmount: detail.remainingAmount
    });

    if (detail.booking?.courtId) {
      realtimeService.toCourt(detail.booking.courtId, "court:booking-updated", {
        bookingId,
        grandTotal: detail.grandTotal,
        remainingAmount: detail.remainingAmount
      });
    }

    return { result, totals: detail };
  },

  async updateBookingServiceQuantity(bookingId: string, serviceId: string, quantity: number, actor: CheckoutActor) {
    await checkoutAccessRepository.assertBooking(bookingId, actor, true);
    const result = await cashierRepository.updateBookingServiceQuantity(bookingId, serviceId, quantity);
    const detail = await cashierRepository.getBookingDetailForCashier(bookingId);

    realtimeService.toBooking(bookingId, "booking:service-updated", {
      bookingId,
      serviceId,
      quantity,
      totals: {
        courtSubtotal: detail.courtSubtotal,
        serviceSubtotal: detail.serviceSubtotal,
        voucherDiscount: detail.voucherDiscount,
        grandTotal: detail.grandTotal,
        remainingAmount: detail.remainingAmount
      }
    });

    realtimeService.toBooking(bookingId, "booking:total-updated", {
      bookingId,
      grandTotal: detail.grandTotal,
      remainingAmount: detail.remainingAmount
    });

    if (detail.booking?.courtId) {
      realtimeService.toCourt(detail.booking.courtId, "court:booking-updated", {
        bookingId,
        grandTotal: detail.grandTotal,
        remainingAmount: detail.remainingAmount
      });
    }

    return { result, totals: detail };
  },

  async removeBookingService(bookingId: string, serviceId: string, actor: CheckoutActor) {
    await checkoutAccessRepository.assertBooking(bookingId, actor, true);
    const result = await cashierRepository.removeBookingService(bookingId, serviceId);
    const detail = await cashierRepository.getBookingDetailForCashier(bookingId);

    realtimeService.toBooking(bookingId, "booking:service-removed", {
      bookingId,
      serviceId,
      totals: {
        courtSubtotal: detail.courtSubtotal,
        serviceSubtotal: detail.serviceSubtotal,
        voucherDiscount: detail.voucherDiscount,
        grandTotal: detail.grandTotal,
        remainingAmount: detail.remainingAmount
      }
    });

    realtimeService.toBooking(bookingId, "booking:total-updated", {
      bookingId,
      grandTotal: detail.grandTotal,
      remainingAmount: detail.remainingAmount
    });

    if (detail.booking?.courtId) {
      realtimeService.toCourt(detail.booking.courtId, "court:booking-updated", {
        bookingId,
        grandTotal: detail.grandTotal,
        remainingAmount: detail.remainingAmount
      });
    }

    return { result, totals: detail };
  },

  async returnRentalItem(input: ReturnRentalItemInput) {
    return cashierRepository.returnRentalItem(input);
  }
};
