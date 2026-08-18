import { realtimeService } from "../realtime/realtime.service.js";
import { cashierRepository } from "./cashier.repository.js";
import type { AddServiceToBookingInput, ReturnRentalItemInput } from "./cashier.types.js";

export const cashierService = {
  async getActiveBookings(partnerId: string, courtId?: string) {
    return cashierRepository.getActiveBookings(partnerId, courtId);
  },

  async getBookingDetailForCashier(bookingId: string) {
    return cashierRepository.getBookingDetailForCashier(bookingId);
  },

  async addServiceToBooking(bookingId: string, input: AddServiceToBookingInput, addedBy: string) {
    const result = await cashierRepository.addServiceToBooking(bookingId, input, addedBy);
    const detail = await cashierRepository.getBookingDetailForCashier(bookingId, true);

    // Emit Realtime socket events
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

    return { result, totals: detail };
  },

  async updateBookingServiceQuantity(bookingId: string, serviceId: string, quantity: number) {
    const result = await cashierRepository.updateBookingServiceQuantity(bookingId, serviceId, quantity);
    const detail = await cashierRepository.getBookingDetailForCashier(bookingId, true);

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

    return { result, totals: detail };
  },

  async removeBookingService(bookingId: string, serviceId: string) {
    const result = await cashierRepository.removeBookingService(bookingId, serviceId);
    const detail = await cashierRepository.getBookingDetailForCashier(bookingId, true);

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

    return { result, totals: detail };
  },

  async returnRentalItem(input: ReturnRentalItemInput) {
    return cashierRepository.returnRentalItem(input);
  }
};
