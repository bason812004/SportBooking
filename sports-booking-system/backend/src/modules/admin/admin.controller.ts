import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { adminService } from "./admin.service.js";

/** An exported list as an Excel or PDF download, named after the list and today's date. */
function sendListFile(res: import("express").Response, buffer: Buffer, format: "excel" | "pdf", name: string) {
  const filename = `${name}-${new Date().toISOString().slice(0, 10)}.${format === "excel" ? "xlsx" : "pdf"}`;
  res.setHeader("Content-Type", format === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

export const adminController = {
  dashboard: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.dashboard())),
  users: asyncHandler(async (req, res) => sendSuccess(res, await adminService.users(req.query))),
  bookings: asyncHandler(async (req, res) => sendSuccess(res, await adminService.bookings(req.query))),
  bookingFilterOptions: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.bookingFilterOptions())),
  overdueBookings: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.overdueBookings())),
  bookingDetail: asyncHandler(async (req, res) => sendSuccess(res, await adminService.bookingDetail(req.params.id))),
  updateBookingAdmin: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.updateBookingAdmin(req.user!.id, req.params.id, req.body))
  ),
  lockUser: asyncHandler(async (req, res) => sendSuccess(res, await adminService.lockUser(req.user!.id, req.params.id, req.body.reason))),
  unlockUser: asyncHandler(async (req, res) => sendSuccess(res, await adminService.unlockUser(req.user!.id, req.params.id))),
  partners: asyncHandler(async (req, res) => sendSuccess(res, await adminService.partners(req.query))),
  partnerDetail: asyncHandler(async (req, res) => sendSuccess(res, await adminService.partnerDetail(req.params.id))),
  approvePartner: asyncHandler(async (req, res) => sendSuccess(res, await adminService.approvePartner(req.user!.id, req.params.id, req.body.reason))),
  rejectPartner: asyncHandler(async (req, res) => sendSuccess(res, await adminService.rejectPartner(req.user!.id, req.params.id, req.body.reason))),
  commissionDefault: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.commissionDefault())),
  commissionHistory: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.commissionHistory())),
  exportCommission: asyncHandler(async (req, res) => {
    const format = req.query.format as "excel" | "pdf";
    sendListFile(res, await adminService.exportCommission(format), format, "ty-le-hoa-hong");
  }),
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
  exportCustomers: asyncHandler(async (req, res) => {
    const query = req.query as any;
    sendListFile(res, await adminService.exportCustomers(req.user!.id, query), query.format, "khach-hang");
  }),
  exportPartners: asyncHandler(async (req, res) => {
    const query = req.query as any;
    sendListFile(res, await adminService.exportPartners(req.user!.id, query), query.format, "doi-tac");
  }),
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
  notificationCampaignRecipients: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.notificationCampaignRecipients(req.params.id, req.query))
  ),
  notificationRecipientGroups: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.notificationRecipientGroups(req.user!.id, req.query.by as "role" | "partner" | "court"))
  ),
  notificationAudience: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.notificationAudience(req.user!.id, req.query as any))
  ),
  recallNotificationCampaign: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.recallNotificationCampaign(req.user!.id, req.params.id, req.body.reason))
  ),
  courts: asyncHandler(async (req, res) => sendSuccess(res, await adminService.courts(req.query))),
  courtDetail: asyncHandler(async (req, res) => sendSuccess(res, await adminService.courtDetail(req.params.id))),
  courtReview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.courtReview(req.params.id))),
  updateCourtAdmin: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.updateCourtAdmin(req.user!.id, req.params.id, req.body))
  ),
  requestCourtUpdate: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.requestCourtUpdate(req.user!.id, req.params.id, req.body.note))
  ),
  pendingCourts: asyncHandler(async (req, res) => sendSuccess(res, await adminService.pendingCourts(req.query))),
  approveCourt: asyncHandler(async (req, res) => sendSuccess(res, await adminService.approveCourt(req.user!.id, req.params.id))),
  rejectCourt: asyncHandler(async (req, res) => sendSuccess(res, await adminService.rejectCourt(req.user!.id, req.params.id, req.body.reason))),
  approvalRevocation: asyncHandler(async (req, res) => sendSuccess(res, await adminService.approvalRevocation(req.params.id))),
  revokeCourtApproval: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.revokeCourtApproval(req.user!.id, req.params.id, req.body.reason))
  ),
  categories: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.categories())),
  createCategory: asyncHandler(async (req, res) => sendSuccess(res, await adminService.createCategory(req.user!.id, req.body), 201)),
  updateCategory: asyncHandler(async (req, res) => sendSuccess(res, await adminService.updateCategory(req.user!.id, req.params.id, req.body))),
  deleteCategory: asyncHandler(async (req, res) => sendSuccess(res, await adminService.deleteCategory(req.user!.id, req.params.id))),
  reviews: asyncHandler(async (req, res) => sendSuccess(res, await adminService.reviews(req.query))),
  reviewStats: asyncHandler(async (req, res) => sendSuccess(res, await adminService.reviewStats(req.query as Record<string, string | undefined>))),
  exportReviewStats: asyncHandler(async (req, res) => {
    const query = req.query as any;
    sendListFile(res, await adminService.exportReviewStats(query), query.format, "thong-ke-danh-gia");
  }),
  hideReview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.setReviewDisplay(req.user!.id, req.params.id, "HIDDEN", req.body.reason))),
  showReview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.setReviewDisplay(req.user!.id, req.params.id, "VISIBLE", req.body.reason))),
  deleteReview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.deleteReview(req.user!.id, req.params.id, req.body.reason))),
  removeReviewReply: asyncHandler(async (req, res) => sendSuccess(res, await adminService.removeReviewReply(req.user!.id, req.params.id, req.body.reason))),
  reports: asyncHandler(async (req, res) => sendSuccess(res, await adminService.reports(req.query))),
  reportThread: asyncHandler(async (req, res) => sendSuccess(res, await adminService.reportThread(req.params.id))),
  sendReportMessage: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.sendReportMessage(req.user!.id, req.params.id, req.body.content), 201)
  ),
  resolveReport: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.decideReport(req.user!.id, req.params.id, "RESOLVED", req.body))
  ),
  rejectReport: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.decideReport(req.user!.id, req.params.id, "REJECTED", req.body))
  ),
  statistics: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.statistics())),
  vouchers: asyncHandler(async (req, res) => sendSuccess(res, await adminService.vouchers(req.query))),
  disableVoucher: asyncHandler(async (req, res) => sendSuccess(res, await adminService.setVoucherStatus(req.user!.id, req.params.id, "DISABLED", req.body.reason))),
  activateVoucher: asyncHandler(async (req, res) => sendSuccess(res, await adminService.setVoucherStatus(req.user!.id, req.params.id, "ACTIVE", req.body.reason))),
  voucherDetail: asyncHandler(async (req, res) => sendSuccess(res, await adminService.voucherDetail(req.params.id))),
  createVoucher: asyncHandler(async (req, res) => sendSuccess(res, await adminService.createVoucher(req.user!.id, req.body), 201)),
  updateVoucher: asyncHandler(async (req, res) => sendSuccess(res, await adminService.updateVoucher(req.user!.id, req.params.id, req.body))),
  pendingBlogs: asyncHandler(async (req, res) => sendSuccess(res, await adminService.pendingBlogs(req.query))),
  approveBlog: asyncHandler(async (req, res) => sendSuccess(res, await adminService.moderateBlog(req.user!.id, req.params.id, "PUBLISHED", req.body.reason))),
  rejectBlog: asyncHandler(async (req, res) => sendSuccess(res, await adminService.moderateBlog(req.user!.id, req.params.id, "REJECTED", req.body.reason))),
  hideBlog: asyncHandler(async (req, res) => sendSuccess(res, await adminService.hideBlog(req.user!.id, req.params.id, req.body.reason))),
  blogHistory: asyncHandler(async (req, res) => sendSuccess(res, await adminService.blogHistory(req.params.id))),
  blogComments: asyncHandler(async (req, res) => sendSuccess(res, await adminService.blogComments(req.params.id))),
  removeBlogComment: asyncHandler(async (req, res) =>
    sendSuccess(res, await adminService.removeBlogComment(req.user!.id, req.params.id, req.params.commentId, req.body.reason))
  ),
  pendingTournaments: asyncHandler(async (req, res) => sendSuccess(res, await adminService.pendingTournaments(req.query))),
  approveTournament: asyncHandler(async (req, res) => sendSuccess(res, await adminService.moderateTournament(req.user!.id, req.params.id, "APPROVED", req.body.reason))),
  rejectTournament: asyncHandler(async (req, res) => sendSuccess(res, await adminService.moderateTournament(req.user!.id, req.params.id, "REJECTED", req.body.reason))),
  auditLogs: asyncHandler(async (req, res) => sendSuccess(res, await adminService.auditLogs(req.query))),
  auditLogFilterOptions: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.auditLogFilterOptions())),
  verifyAuditLogs: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.verifyAuditLogs())),
  blockchainLogs: asyncHandler(async (req, res) => sendSuccess(res, await adminService.blockchainLogs(req.query)))
};
