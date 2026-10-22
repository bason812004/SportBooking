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
  ),
  getBill: asyncHandler(async (req, res) =>
    sendSuccess(res, await bookingService.getBookingBill(req.user!.id, req.params.id, req.user?.role))
  ),
  getServices: asyncHandler(async (req, res) =>
    sendSuccess(res, await bookingService.getBookingServices(req.user!.id, req.params.id, req.user?.role))
  ),
  addService: asyncHandler(async (req, res) =>
    sendSuccess(res, await bookingService.addServiceToBooking(req.user!.id, req.params.id, req.body, req.user?.role), 201)
  ),
  updateService: asyncHandler(async (req, res) =>
    sendSuccess(
      res,
      await bookingService.updateBookingServiceQuantity(
        req.user!.id,
        req.params.id,
        req.params.serviceId,
        Number(req.body.quantity),
        req.user?.role
      )
    )
  ),
  removeService: asyncHandler(async (req, res) =>
    sendSuccess(res, await bookingService.removeBookingService(req.user!.id, req.params.id, req.params.serviceId, req.user?.role))
  ),
  checkoutBooking: asyncHandler(async (req, res) =>
    sendSuccess(res, await bookingService.checkoutBooking(req.user!.id, req.params.id, req.user?.role))
  )
};
