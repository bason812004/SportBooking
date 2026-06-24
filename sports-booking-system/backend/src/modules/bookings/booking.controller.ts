import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { bookingService } from "./booking.service.js";

export const bookingController = {
  quote: asyncHandler(async (req, res) => sendSuccess(res, await bookingService.quote(req.user!.id, req.body))),
  checkout: asyncHandler(async (req, res) => sendSuccess(res, await bookingService.checkout(req.user!.id, req.body), 201)),
  create: asyncHandler(async (req, res) => sendSuccess(res, await bookingService.create(req.user!.id, req.body), 201)),
  detail: asyncHandler(async (req, res) => sendSuccess(res, await bookingService.getForUser(req.user!.id, req.params.id))),
  cancel: asyncHandler(async (req, res) =>
    sendSuccess(res, await bookingService.cancel(req.user!.id, req.params.id, req.body.cancelReason))
  )
};
