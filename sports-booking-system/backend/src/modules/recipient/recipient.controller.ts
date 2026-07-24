import { BookingStatus } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { recipientService } from "./recipient.service.js";

export const recipientController = {
  dashboard: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.dashboard(req.user!.id))),
  bookings: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.bookings(req.user!.id, req.query))),
  confirm: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.CONFIRMED))),
  reject: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.CANCELLED))),
  complete: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.COMPLETED))),
  noShow: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.NO_SHOW))),
  calendar: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.calendar(req.user!.id, req.query as any))),
  courtSurfaces: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.courtSurfaces(req.user!.id))),
  updateCourtSurfaceStatus: asyncHandler(async (req, res) =>
    sendSuccess(res, await recipientService.updateCourtSurfaceStatus(req.user!.id, req.params.id, req.body.status))
  ),
  surfaceAvailability: asyncHandler(async (req, res) =>
    sendSuccess(
      res,
      await recipientService.surfaceAvailability(
        req.user!.id,
        req.params.id,
        (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10)
      )
    )
  ),
  lockSurfaceSlot: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.lockSurfaceSlot(req.user!.id, req.params.id, req.body), 201)),
  unlockSurfaceSlot: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.unlockSurfaceSlot(req.user!.id, req.params.id))),
  operations: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.operations(req.user!.id, req.query as any))),
  extendBooking: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.extendBooking(req.user!.id, req.params.id, req.body.minutes))),
  lookupCustomers: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.lookupCustomersByPhone(req.user!.id, req.query.phone as string))),
  customerHistory: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.customerBookingHistory(req.user!.id, req.params.id))),
  createWalkInBooking: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.createWalkInBooking(req.user!.id, req.body), 201)),
  createWalkInBookingOrder: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.createWalkInBookingOrder(req.user!.id, req.body), 201)),
  createRecurringWalkInBooking: asyncHandler(async (req, res) =>
    sendSuccess(res, await recipientService.createRecurringWalkInBooking(req.user!.id, req.body), 201)
  ),
  earlyCheckInBooking: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.earlyCheckInBooking(req.user!.id, req.params.id))),
  earlyCheckOutBooking: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.earlyCheckOutBooking(req.user!.id, req.params.id))),
  paymentStatus: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.paymentStatus(req.user!.id, req.params.id))),
  confirmWalkInPayment: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.confirmWalkInPayment(req.user!.id, req.params.id)))
};
