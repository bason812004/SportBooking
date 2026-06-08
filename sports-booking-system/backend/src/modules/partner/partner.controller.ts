import { BookingStatus } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { partnerService } from "./partner.service.js";

export const partnerController = {
  dashboard: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.dashboard(req.user!.id))),
  courts: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.courts(req.user!.id))),
  createCourt: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.createCourt(req.user!.id, req.body), 201)),
  courtDetail: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.courtDetail(req.user!.id, req.params.id))),
  updateCourt: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateCourt(req.user!.id, req.params.id, req.body))),
  deactivateCourt: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deactivateCourt(req.user!.id, req.params.id))),
  addImage: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.addImage(req.user!.id, req.params.id, req.body, req.file), 201)),
  addPrice: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.addPrice(req.user!.id, req.params.id, req.body), 201)),
  updatePrice: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updatePrice(req.user!.id, req.params.priceId, req.body))),
  deletePrice: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deletePrice(req.user!.id, req.params.priceId))),
  addService: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.addService(req.user!.id, req.params.id, req.body), 201)),
  updateService: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateService(req.user!.id, req.params.serviceId, req.body))),
  deleteService: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deleteService(req.user!.id, req.params.serviceId))),
  bookings: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.bookings(req.user!.id, req.query))),
  confirm: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.CONFIRMED))),
  reject: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.CANCELLED))),
  complete: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.COMPLETED))),
  noShow: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.NO_SHOW))),
  revenue: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.revenue(req.user!.id)))
};
