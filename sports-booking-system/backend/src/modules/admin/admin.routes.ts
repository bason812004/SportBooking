import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { adminController } from "./admin.controller.js";
import { courtImageController } from "../court-images/courtImage.controller.js";
import { imageReviewSchema } from "../court-images/courtImage.validation.js";
import { voucherIdParamsSchema, voucherUpdateSchema, voucherWriteSchema } from "../vouchers/voucher.validation.js";
import {
  adminCourtQuerySchema,
  auditLogQuerySchema,
  adminCourtRequestUpdateSchema,
  adminCourtUpdateSchema,
  blogApproveSchema,
  blogCommentRemovalSchema,
  blogDecisionSchema,
  blogIdParamsSchema,
  blogModerationQuerySchema,
  bookingAdminUpdateSchema,
  bookingQuerySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  commissionExportQuerySchema,
  commissionRateSchema,
  commissionReportSchema,
  defaultCommissionRateSchema,
  financeMonthSchema,
  financeRefundQuerySchema,
  financeTransactionQuerySchema,
  listQuerySchema,
  lockUserSchema,
  moderationSchema,
  notificationAudienceQuerySchema,
  notificationRecipientGroupsSchema,
  notificationCampaignCreateSchema,
  notificationCampaignIdSchema,
  notificationCampaignQuerySchema,
  notificationCampaignRecallSchema,
  notificationCampaignRecipientsSchema,
  partnerQuerySchema,
  partnerExportQuerySchema,
  rejectSchema,
  reportListQuerySchema,
  reportMessageSchema,
  reportRejectSchema,
  reportResolveSchema,
  reportThreadSchema,
  reviewDecisionSchema,
  reviewListQuerySchema,
  reviewRestoreSchema,
  reviewStatsExportQuerySchema,
  reviewStatsQuerySchema,
  userQuerySchema,
  customerExportQuerySchema,
  voucherListQuerySchema
} from "./admin.validation.js";

export const adminRoutes = Router();

adminRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminRoutes.get("/court-image-requests", courtImageController.pending);
adminRoutes.post("/court-image-requests/:id/review", validate(imageReviewSchema), courtImageController.review);
adminRoutes.get("/dashboard", adminController.dashboard);
adminRoutes.get("/users", validate(userQuerySchema), adminController.users);
adminRoutes.get("/users/export", validate(customerExportQuerySchema), adminController.exportCustomers);
adminRoutes.put("/users/:id/lock", validate(lockUserSchema), adminController.lockUser);
adminRoutes.put("/users/:id/unlock", adminController.unlockUser);
adminRoutes.get("/bookings", validate(bookingQuerySchema), adminController.bookings);
adminRoutes.get("/bookings/filter-options", adminController.bookingFilterOptions);
adminRoutes.get("/bookings/overdue", adminController.overdueBookings);
adminRoutes.get("/bookings/:id", adminController.bookingDetail);
adminRoutes.patch("/bookings/:id/admin", validate(bookingAdminUpdateSchema), adminController.updateBookingAdmin);
adminRoutes.get("/partners", validate(partnerQuerySchema), adminController.partners);
// Before /partners/:id, which would take "export" for a partner id.
adminRoutes.get("/partners/export", validate(partnerExportQuerySchema), adminController.exportPartners);
adminRoutes.get("/partners/:id", adminController.partnerDetail);
adminRoutes.put("/partners/:id/approve", validate(moderationSchema), adminController.approvePartner);
adminRoutes.put("/partners/:id/reject", validate(rejectSchema), adminController.rejectPartner);
adminRoutes.get("/commission/default", adminController.commissionDefault);
adminRoutes.get("/commission/history", adminController.commissionHistory);
adminRoutes.get("/commission/export", validate(commissionExportQuerySchema), adminController.exportCommission);
adminRoutes.patch("/commission/default", validate(defaultCommissionRateSchema), adminController.updateCommissionDefault);
adminRoutes.get("/commission/partner/:id", adminController.partnerCommission);
adminRoutes.patch("/commission/partner/:id", validate(commissionRateSchema), adminController.updatePartnerCommission);
adminRoutes.get("/commission/report", validate(commissionReportSchema), adminController.commissionReport);
adminRoutes.get("/finance/transactions", validate(financeTransactionQuerySchema), adminController.financeTransactions);
adminRoutes.get("/finance/refunds", validate(financeRefundQuerySchema), adminController.financeRefunds);
adminRoutes.get("/finance/reconciliation", validate(financeMonthSchema), adminController.financeReconciliation);
adminRoutes.get("/finance/export", validate(financeMonthSchema), adminController.financeExport);
adminRoutes.get("/notifications/campaigns", validate(notificationCampaignQuerySchema), adminController.notificationCampaigns);
adminRoutes.post("/notifications/campaigns", validate(notificationCampaignCreateSchema), adminController.createNotificationCampaign);
adminRoutes.get("/notifications/audience", validate(notificationAudienceQuerySchema), adminController.notificationAudience);
adminRoutes.get("/notifications/recipient-groups", validate(notificationRecipientGroupsSchema), adminController.notificationRecipientGroups);
adminRoutes.get("/notifications/campaigns/:id", validate(notificationCampaignIdSchema), adminController.notificationCampaignDetail);
adminRoutes.get("/notifications/campaigns/:id/recipients", validate(notificationCampaignRecipientsSchema), adminController.notificationCampaignRecipients);
adminRoutes.post("/notifications/campaigns/:id/recall", validate(notificationCampaignRecallSchema), adminController.recallNotificationCampaign);
adminRoutes.get("/courts/pending", adminController.pendingCourts);
adminRoutes.get("/courts", validate(adminCourtQuerySchema), adminController.courts);
adminRoutes.get("/courts/:id", adminController.courtDetail);
adminRoutes.get("/courts/:id/review", adminController.courtReview);
adminRoutes.patch("/courts/:id/admin", validate(adminCourtUpdateSchema), adminController.updateCourtAdmin);
adminRoutes.post("/courts/:id/request-update", validate(adminCourtRequestUpdateSchema), adminController.requestCourtUpdate);
adminRoutes.put("/courts/:id/approve", adminController.approveCourt);
adminRoutes.put("/courts/:id/reject", validate(rejectSchema), adminController.rejectCourt);
adminRoutes.get("/courts/:id/approval-revocation", adminController.approvalRevocation);
adminRoutes.put("/courts/:id/revoke-approval", validate(rejectSchema), adminController.revokeCourtApproval);
adminRoutes.get("/categories", adminController.categories);
adminRoutes.post("/categories", validate(categoryCreateSchema), adminController.createCategory);
adminRoutes.put("/categories/:id", validate(categoryUpdateSchema), adminController.updateCategory);
adminRoutes.delete("/categories/:id", adminController.deleteCategory);
adminRoutes.get("/reviews", validate(reviewListQuerySchema), adminController.reviews);
adminRoutes.get("/reviews/stats", validate(reviewStatsQuerySchema), adminController.reviewStats);
adminRoutes.get("/reviews/stats/export", validate(reviewStatsExportQuerySchema), adminController.exportReviewStats);
adminRoutes.put("/reviews/:id/hide", validate(reviewDecisionSchema), adminController.hideReview);
adminRoutes.put("/reviews/:id/show", validate(reviewRestoreSchema), adminController.showReview);
adminRoutes.delete("/reviews/:id", validate(reviewDecisionSchema), adminController.deleteReview);
adminRoutes.delete("/reviews/:id/reply", validate(reviewDecisionSchema), adminController.removeReviewReply);
adminRoutes.get("/reports", validate(reportListQuerySchema), adminController.reports);
adminRoutes.get("/reports/:id", validate(reportThreadSchema), adminController.reportThread);
adminRoutes.post("/reports/:id/messages", validate(reportMessageSchema), adminController.sendReportMessage);
adminRoutes.put("/reports/:id/resolve", validate(reportResolveSchema), adminController.resolveReport);
adminRoutes.put("/reports/:id/reject", validate(reportRejectSchema), adminController.rejectReport);
adminRoutes.get("/statistics", adminController.statistics);
adminRoutes.get("/vouchers", validate(voucherListQuerySchema), adminController.vouchers);
adminRoutes.put("/vouchers/:id/disable", validate(moderationSchema), adminController.disableVoucher);
adminRoutes.put("/vouchers/:id/activate", validate(moderationSchema), adminController.activateVoucher);
adminRoutes.get("/vouchers/:id", validate(voucherIdParamsSchema), adminController.voucherDetail);
adminRoutes.post("/vouchers", validate(voucherWriteSchema), adminController.createVoucher);
adminRoutes.put("/vouchers/:id", validate(voucherUpdateSchema), adminController.updateVoucher);
adminRoutes.get("/blogs/pending", validate(blogModerationQuerySchema), adminController.pendingBlogs);
adminRoutes.get("/blogs/:id/history", validate(blogIdParamsSchema), adminController.blogHistory);
adminRoutes.get("/blogs/:id/comments", validate(blogIdParamsSchema), adminController.blogComments);
adminRoutes.delete("/blogs/:id/comments/:commentId", validate(blogCommentRemovalSchema), adminController.removeBlogComment);
adminRoutes.put("/blogs/:id/approve", validate(blogApproveSchema), adminController.approveBlog);
adminRoutes.put("/blogs/:id/reject", validate(blogDecisionSchema), adminController.rejectBlog);
adminRoutes.put("/blogs/:id/hide", validate(blogDecisionSchema), adminController.hideBlog);
adminRoutes.get("/tournaments/pending", validate(listQuerySchema), adminController.pendingTournaments);
adminRoutes.put("/tournaments/:id/approve", validate(moderationSchema), adminController.approveTournament);
adminRoutes.put("/tournaments/:id/reject", validate(rejectSchema), adminController.rejectTournament);
adminRoutes.get("/audit-logs", validate(auditLogQuerySchema), adminController.auditLogs);
adminRoutes.get("/audit-logs/filter-options", adminController.auditLogFilterOptions);
adminRoutes.get("/audit-logs/verify", adminController.verifyAuditLogs);
adminRoutes.get("/blockchain-logs", validate(listQuerySchema), adminController.blockchainLogs);
