import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { adminService } from "./admin.service.js";

export const adminController = {
  dashboard: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.dashboard())),
  courtLocations: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.courtLocations())),
  users: asyncHandler(async (req, res) => sendSuccess(res, await adminService.users(req.query))),
  bookings: asyncHandler(async (req, res) => sendSuccess(res, await adminService.bookings(req.query))),
  bookingDetail: asyncHandler(async (req, res) => sendSuccess(res, await adminService.bookingDetail(req.params.id))),
  updateBookingAdmin: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.updateBookingAdmin(req.user!.id, req.params.id, req.body))
  ),
  lockUser: asyncHandler(async (req, res) => sendSuccess(res, await adminService.lockUser(req.user!.id, req.params.id))),
  unlockUser: asyncHandler(async (req, res) => sendSuccess(res, await adminService.unlockUser(req.user!.id, req.params.id))),
  partners: asyncHandler(async (req, res) => sendSuccess(res, await adminService.partners(req.query))),
  partnerDetail: asyncHandler(async (req, res) => sendSuccess(res, await adminService.partnerDetail(req.params.id))),
  approvePartner: asyncHandler(async (req, res) => sendSuccess(res, await adminService.approvePartner(req.user!.id, req.params.id, req.body.reason))),
  rejectPartner: asyncHandler(async (req, res) => sendSuccess(res, await adminService.rejectPartner(req.user!.id, req.params.id, req.body.reason))),
  commissionDefault: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.commissionDefault())),
  updateCommissionDefault: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.updateCommissionDefault(req.user!.id, req.body.rate))
  ),
  partnerCommission: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.partnerCommission(req.params.id))
  ),
  updatePartnerCommission: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.updatePartnerCommission(req.user!.id, req.params.id, req.body.rate))
  ),
  commissionReport: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.commissionReport(req.query.month as string | undefined))
  ),
  financeTransactions: asyncHandler(async (req, res) => sendSuccess(res, await adminService.financeTransactions(req.query))),
  financeRefunds: asyncHandler(async (req, res) => sendSuccess(res, await adminService.financeRefunds(req.query))),
  financeReconciliation: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.financeReconciliation(req.query.month as string | undefined))
  ),
  updatePayout: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.updatePayout(req.user!.id, req.params.partnerId, req.query.month as string | undefined, req.body))
  ),
  financeExport: asyncHandler(async (req, res) => {
    const file = await adminService.financeExport(req.query.month as string | undefined);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.content);
  }),
  notificationCampaigns: asyncHandler(async (req, res) => sendSuccess(res, await adminService.notificationCampaigns(req.query))),
  notificationCampaignDetail: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.notificationCampaignDetail(req.params.id))
  ),
  createNotificationCampaign: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.createNotificationCampaign(req.user!.id, req.body), 201)
  ),
  courts: asyncHandler(async (req, res) => sendSuccess(res, await adminService.courts(req.query))),
  courtDetail: asyncHandler(async (req, res) => sendSuccess(res, await adminService.courtDetail(req.params.id))),
  updateCourtAdmin: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.updateCourtAdmin(req.user!.id, req.params.id, req.body))
  ),
  requestCourtUpdate: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.requestCourtUpdate(req.user!.id, req.params.id, req.body.note))
  ),
  pendingCourts: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.pendingCourts())),
  approveCourt: asyncHandler(async (req, res) => sendSuccess(res, await adminService.approveCourt(req.user!.id, req.params.id))),
  rejectCourt: asyncHandler(async (req, res) => sendSuccess(res, await adminService.rejectCourt(req.user!.id, req.params.id, req.body.reason))),
  categories: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.categories())),
  createCategory: asyncHandler(async (req, res) => sendSuccess(res, await adminService.createCategory(req.user!.id, req.body), 201)),
  updateCategory: asyncHandler(async (req, res) => sendSuccess(res, await adminService.updateCategory(req.user!.id, req.params.id, req.body))),
  deleteCategory: asyncHandler(async (req, res) => sendSuccess(res, await adminService.deleteCategory(req.user!.id, req.params.id))),
  reviews: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.reviews())),
  hideReview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.hideReview(req.user!.id, req.params.id))),
  showReview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.showReview(req.user!.id, req.params.id))),
  deleteReview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.deleteReview(req.user!.id, req.params.id))),
  reports: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.reports())),
  resolveReport: asyncHandler(async (req, res) => sendSuccess(res, await adminService.resolveReport(req.user!.id, req.params.id))),
  rejectReport: asyncHandler(async (req, res) => sendSuccess(res, await adminService.rejectReport(req.user!.id, req.params.id))),
  statistics: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.statistics())),
  vouchers: asyncHandler(async (req, res) => sendSuccess(res, await adminService.vouchers(req.query))),
  disableVoucher: asyncHandler(async (req, res) => sendSuccess(res, await adminService.setVoucherStatus(req.user!.id, req.params.id, "DISABLED", req.body.reason))),
  activateVoucher: asyncHandler(async (req, res) => sendSuccess(res, await adminService.setVoucherStatus(req.user!.id, req.params.id, "ACTIVE", req.body.reason))),
  pendingBlogs: asyncHandler(async (req, res) => sendSuccess(res, await adminService.pendingBlogs(req.query))),
  approveBlog: asyncHandler(async (req, res) => sendSuccess(res, await adminService.moderateBlog(req.user!.id, req.params.id, "PUBLISHED", req.body.reason))),
  rejectBlog: asyncHandler(async (req, res) => sendSuccess(res, await adminService.moderateBlog(req.user!.id, req.params.id, "REJECTED", req.body.reason))),
  pendingTournaments: asyncHandler(async (req, res) => sendSuccess(res, await adminService.pendingTournaments(req.query))),
  approveTournament: asyncHandler(async (req, res) => sendSuccess(res, await adminService.moderateTournament(req.user!.id, req.params.id, "APPROVED", req.body.reason))),
  rejectTournament: asyncHandler(async (req, res) => sendSuccess(res, await adminService.moderateTournament(req.user!.id, req.params.id, "REJECTED", req.body.reason))),
  auditLogs: asyncHandler(async (req, res) => sendSuccess(res, await adminService.auditLogs(req.query))),
  verifyAuditLogs: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.verifyAuditLogs())),
  blockchainLogs: asyncHandler(async (req, res) => sendSuccess(res, await adminService.blockchainLogs(req.query))),
  retryBlockchainLog: asyncHandler(async (req, res) => sendSuccess(res, await adminService.retryBlockchainLog(req.user!.id, req.params.id)))
};
