import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { checkoutAccessRepository, type CheckoutActor } from "../checkout/checkout.access.js";
import { assertNothingOwed } from "../checkout/checkout.balance.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { settlementService } from "../settlements/settlement.service.js";
import { checkInBooking } from "../recipient/recipient.counter.js";
import { cashierRepository } from "./cashier.repository.js";
import type { AddServiceToBookingInput, ReturnRentalItemInput } from "./cashier.types.js";
import { notifyStockAlerts } from "../inventory/inventory.alerts.js";
import type { StockAlert } from "../inventory/inventory.stock.js";

/** Sessions the counter can finish: the customer checked in (or a payment already started). */
const FINISHABLE_SESSION_STATUSES: BookingStatus[] = [BookingStatus.IN_PROGRESS, BookingStatus.CHECKOUT_PENDING];

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

  /**
   * Ends a session at the counter when the customer owes nothing (everything was paid online, or at the counter
   * already): the booking finishes now, keeping its booked hours. Only a checked-in session; money still owed is
   * taken through the payment, which finishes the booking itself.
   */
  async finishSession(bookingId: string, actor: CheckoutActor) {
    await checkoutAccessRepository.assertBooking(bookingId, actor, true);
    const booking = await cashierRepository.sessionBooking(bookingId);
    if (!booking) throw new NotFoundError("Booking không tồn tại");
    if (!FINISHABLE_SESSION_STATUSES.includes(booking.bookingStatus)) {
      throw new ValidationError("Chỉ hoàn tất được phiên khách đang chơi (đã check-in)");
    }
    const settlement = await cashierRepository.transaction(async (tx) => {
      await assertNothingOwed(booking.id, tx);
      if (!(await cashierRepository.completeSession(booking.id, booking.bookingStatus, tx))) {
        throw new ConflictError("Phiên vừa được cập nhật ở nơi khác, hãy tải lại trang");
      }
      const finished = await cashierRepository.sessionBooking(booking.id, tx);
      return settlementService.finishBooking(finished!, "COMPLETED", tx);
    });

    realtimeService.toBooking(bookingId, "booking:status-changed", { bookingId, status: "COMPLETED" });
    realtimeService.toCourt(booking.courtId, "court:booking-updated", { bookingId, isCompleted: true, status: "COMPLETED" });
    if (settlement) {
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
    }
    return { id: booking.id, bookingStatus: "COMPLETED" as const };
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
    // Products this sale took to their reorder level: the partner hears once the sale has committed.
    const alerts: StockAlert[] = [];
    const result = await cashierRepository.addServiceToBooking(bookingId, input, addedBy, alerts);
    void notifyStockAlerts(alerts);
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
    const alerts: StockAlert[] = [];
    const result = await cashierRepository.updateBookingServiceQuantity(bookingId, serviceId, quantity, alerts);
    void notifyStockAlerts(alerts);
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
