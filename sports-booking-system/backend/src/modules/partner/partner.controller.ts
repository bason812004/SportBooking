import { BookingStatus } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { partnerService } from "./partner.service.js";

export const partnerController = {
  dashboard: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.dashboard(req.user!.id))),
  profile: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.profile(req.user!.id))),
  updateProfile: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateProfile(req.user!.id, req.body))),
  courts: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.courts(req.user!.id))),
  createCourt: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.createCourt(req.user!.id, req.body), 201)),
  courtDetail: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.courtDetail(req.user!.id, req.params.id))),
  updateCourt: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateCourt(req.user!.id, req.params.id, req.body))),
  deactivateCourt: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deactivateCourt(req.user!.id, req.params.id))),
  addImage: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.addImage(req.user!.id, req.params.id, req.body, req.file), 201)),
  deleteImage: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deleteImage(req.user!.id, req.params.imageId))),
  reorderImages: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.reorderImages(req.user!.id, req.params.id, req.body.imageIds))),
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
  revenue: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.revenue(req.user!.id, req.query.month as string | undefined))
  ),
  calendar: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.calendar(req.user!.id, req.query as any))),
  vouchers: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.vouchers(req.user!.id))),
  voucherDetail: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.voucherDetail(req.user!.id, req.params.id))
  ),
  createVoucher: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.createVoucher(req.user!.id, req.body), 201)
  ),
  updateVoucher: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.updateVoucher(req.user!.id, req.params.id, req.body))
  ),
  activateVoucher: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.activateVoucher(req.user!.id, req.params.id))
  ),
  disableVoucher: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.disableVoucher(req.user!.id, req.params.id))
  ),
  deleteVoucher: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.deleteVoucher(req.user!.id, req.params.id))
  ),
  blogs: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.blogs(req.user!.id))),
  blogDetail: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.blogDetail(req.user!.id, req.params.id))),
  createBlog: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.createBlog(req.user!.id, req.body), 201)),
  updateBlog: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateBlog(req.user!.id, req.params.id, req.body))),
  submitBlog: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.submitBlog(req.user!.id, req.params.id))),
  deleteBlog: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deleteBlog(req.user!.id, req.params.id))),
  tournaments: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.tournaments(req.user!.id))),
  tournamentDetail: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.tournamentDetail(req.user!.id, req.params.id))),
  createTournament: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.createTournament(req.user!.id, req.body), 201)),
  updateTournament: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateTournament(req.user!.id, req.params.id, req.body))),
  submitTournament: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.submitTournament(req.user!.id, req.params.id))),
  deleteTournament: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deleteTournament(req.user!.id, req.params.id)))
};
