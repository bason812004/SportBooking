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
  calendar: asyncHandler(async (req, res) => sendSuccess(res, await recipientService.calendar(req.user!.id, req.query as any)))
};
