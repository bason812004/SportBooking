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
  registerCourts: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.registerCourts(req.user!.id, req.body), 201)),
  courtDetail: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.courtDetail(req.user!.id, req.params.id))),
  timeChargePolicy: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.timeChargePolicy(req.user!.id, req.params.id))),
  updateTimeChargePolicy: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.updateTimeChargePolicy(req.user!.id, req.params.id, req.body), 200, "Đã lưu chính sách giờ phát sinh")
  ),
  updateCourt: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateCourt(req.user!.id, req.params.id, req.body))),
  deactivateCourt: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deactivateCourt(req.user!.id, req.params.id))),
  updateCourtStatus: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateCourtStatus(req.user!.id, req.params.id, req.body.activeStatus))),
  courtBlocks: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.courtBlocks(req.user!.id, req.params.id))),
  createCourtBlock: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.createCourtBlock(req.user!.id, req.params.id, req.body), 201)),
  cancelCourtBlock: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.cancelCourtBlock(req.user!.id, req.params.id, req.params.blockId))),
  courtAvailabilityGrid: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.courtAvailabilityGrid(req.user!.id, req.params.id, req.query.date as string))),
  createCourtBlockBulk: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.createCourtBlockBulk(req.user!.id, req.params.id, req.body), 201)),
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
  overdueBookings: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.overdueBookings(req.user!.id))),
  confirm: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.CONFIRMED))),
  reject: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.CANCELLED, req.body.reason))
  ),
  affectedBookings: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.affectedBookings(req.user!.id, req.params.id, req.query as Record<string, string>))
  ),
  complete: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.COMPLETED))),
  noShow: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateBookingStatus(req.user!.id, req.params.id, BookingStatus.NO_SHOW))),
  uploadProfileDocument: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.uploadProfileDocument(req.user!.id, req.file), 201, "Đã tải giấy tờ lên")
  ),
  revenue: asyncHandler(async (req, res) =>
    sendSuccess(res, await partnerService.revenue(req.user!.id, req.query.month as string | undefined))
  ),
  calendar: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.calendar(req.user!.id, req.query as any))),
  courtSurfaces: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.courtSurfaces(req.user!.id, req.params.id))),
  createCourtSurface: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.createCourtSurface(req.user!.id, req.params.id, req.body), 201)),
  deleteCourtSurface: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deleteCourtSurface(req.user!.id, req.params.id, req.params.surfaceId))),
  updateCourtSurfaceStatus: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateCourtSurfaceStatus(req.user!.id, req.params.id, req.params.surfaceId, req.body.status))),
  updateCourtSurface: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateCourtSurface(req.user!.id, req.params.id, req.params.surfaceId, req.body))),
  reviews: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.reviews(req.user!.id, req.query))),
  replyReview: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.replyReview(req.user!.id, req.params.id, req.body.reply))),
  deleteReviewReply: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deleteReviewReply(req.user!.id, req.params.id))),
  blogs: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.blogs(req.user!.id))),
  blogDetail: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.blogDetail(req.user!.id, req.params.id))),
  createBlog: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.createBlog(req.user!.id, req.body), 201)),
  updateBlog: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateBlog(req.user!.id, req.params.id, req.body))),
  updateBlogComments: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateBlogComments(req.user!.id, req.params.id, req.body.allowComments))),
  submitBlog: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.submitBlog(req.user!.id, req.params.id))),
  deleteBlog: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.deleteBlog(req.user!.id, req.params.id))),
  listRecipients: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.listRecipients(req.user!.id))),
  createRecipient: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.createRecipient(req.user!.id, req.body), 201)),
  updateRecipient: asyncHandler(async (req, res) => sendSuccess(res, await partnerService.updateRecipient(req.user!.id, req.params.id, req.body))),
  setRecipientStatus: asyncHandler(async (req, res) => {
    const result = await partnerService.setRecipientStatus(req.user!.id, req.params.id, req.body.status);
    return sendSuccess(res, result, 200, req.body.status === "LOCKED" ? "Đã khoá tài khoản nhân viên" : "Đã mở khoá tài khoản nhân viên");
  }),
  deleteRecipient: asyncHandler(async (req, res) => {
    const result = await partnerService.deleteRecipient(req.user!.id, req.params.id);
    return sendSuccess(
      res,
      result,
      200,
      result.deleted ? "Đã xoá nhân viên" : "Nhân viên đã có lịch sử thao tác nên tài khoản được khoá thay vì xoá"
    );
  })
};
