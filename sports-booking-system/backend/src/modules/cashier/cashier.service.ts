import { prisma } from "../../config/db.js";
import { NotFoundError } from "../../shared/errors/AppError.js";
import { checkoutAccessRepository, type CheckoutActor } from "../checkout/checkout.access.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { checkInBooking } from "../recipient/recipient.counter.js";
import { cashierRepository } from "./cashier.repository.js";
import type { AddServiceToBookingInput, ReturnRentalItemInput } from "./cashier.types.js";

export const cashierService = {
  scopeFor(userId: string, role: string) {
    return cashierRepository.scopeFor(userId, role);
  },

  async getActiveBookings(partnerId: string | null, courtId?: string, search?: string, filter?: string) {
    return cashierRepository.getActiveBookings(partnerId, courtId, search, filter);
  },

  /** Locks (or unlocks) the invoice's services for every device; payments still go through. */
  async setInvoiceLock(bookingId: string, actor: CheckoutActor, locked: boolean) {
    await checkoutAccessRepository.assertBooking(bookingId, actor, true);
    const result = await cashierRepository.setInvoiceLock(bookingId, locked ? actor.id : null);
    realtimeService.toBooking(bookingId, "booking:invoice-lock", { bookingId, locked, lockedAt: result.invoiceLockedAt });
    return result;
  },

  async getBookingDetailForCashier(bookingId: string, actor: CheckoutActor) {
    await checkoutAccessRepository.assertBooking(bookingId, actor);
    return cashierRepository.getBookingDetailForCashier(bookingId);
  },

  /** Same rule as the staff counter screen, early check-in charge included (recipient.counter). */
  async checkInBooking(bookingId: string, actor: CheckoutActor) {
    await checkoutAccessRepository.assertBooking(bookingId, actor, true);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundError("Booking không tồn tại");
    return checkInBooking(booking);
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
      // Court rooms are joined by public court pages: no invoice amounts (they go to the booking room).
      realtimeService.toCourt(detail.booking.courtId, "court:booking-updated", { bookingId });
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
      // Court rooms are joined by public court pages: no invoice amounts (they go to the booking room).
      realtimeService.toCourt(detail.booking.courtId, "court:booking-updated", { bookingId });
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
      // Court rooms are joined by public court pages: no invoice amounts (they go to the booking room).
      realtimeService.toCourt(detail.booking.courtId, "court:booking-updated", { bookingId });
    }

    return { result, totals: detail };
  },

  /** Only for gear rented at a court the actor works at. */
  async returnRentalItem(input: ReturnRentalItemInput, actor: CheckoutActor) {
    const bookingId = await cashierRepository.rentalItemBooking(input.rentalItemId);
    if (!bookingId) throw new NotFoundError("Thiết bị thuê không tồn tại");
    await checkoutAccessRepository.assertBooking(bookingId, actor, true);
    return cashierRepository.returnRentalItem(input);
  }
};
