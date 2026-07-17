import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { adminController } from "./admin.controller.js";
import {
  adminCourtQuerySchema,
  adminCourtRequestUpdateSchema,
  adminCourtUpdateSchema,
  bookingAdminUpdateSchema,
  bookingQuerySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  commissionRateSchema,
  commissionReportSchema,
  defaultCommissionRateSchema,
  financeMonthSchema,
  financeRefundQuerySchema,
  financeTransactionQuerySchema,
  listQuerySchema,
  moderationSchema,
  notificationCampaignCreateSchema,
  notificationCampaignQuerySchema,
  payoutUpdateSchema,
  partnerQuerySchema,
  rejectSchema
  ,userQuerySchema
} from "./admin.validation.js";

export const adminRoutes = Router();

adminRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminRoutes.get("/dashboard", adminController.dashboard);
adminRoutes.get("/users", validate(userQuerySchema), adminController.users);
adminRoutes.put("/users/:id/lock", adminController.lockUser);
adminRoutes.put("/users/:id/unlock", adminController.unlockUser);
adminRoutes.get("/bookings", validate(bookingQuerySchema), adminController.bookings);
adminRoutes.get("/bookings/:id", adminController.bookingDetail);
adminRoutes.patch("/bookings/:id/admin", validate(bookingAdminUpdateSchema), adminController.updateBookingAdmin);
adminRoutes.get("/partners", validate(partnerQuerySchema), adminController.partners);
adminRoutes.get("/partners/:id", adminController.partnerDetail);
adminRoutes.put("/partners/:id/approve", validate(moderationSchema), adminController.approvePartner);
adminRoutes.put("/partners/:id/reject", validate(rejectSchema), adminController.rejectPartner);
adminRoutes.get("/commission/default", adminController.commissionDefault);
adminRoutes.patch("/commission/default", validate(defaultCommissionRateSchema), adminController.updateCommissionDefault);
adminRoutes.get("/commission/partner/:id", adminController.partnerCommission);
adminRoutes.patch("/commission/partner/:id", validate(commissionRateSchema), adminController.updatePartnerCommission);
adminRoutes.get("/commission/report", validate(commissionReportSchema), adminController.commissionReport);
adminRoutes.get("/finance/transactions", validate(financeTransactionQuerySchema), adminController.financeTransactions);
adminRoutes.get("/finance/refunds", validate(financeRefundQuerySchema), adminController.financeRefunds);
adminRoutes.get("/finance/reconciliation", validate(financeMonthSchema), adminController.financeReconciliation);
adminRoutes.get("/finance/export", validate(financeMonthSchema), adminController.financeExport);
adminRoutes.patch("/finance/payouts/:partnerId", validate(financeMonthSchema), validate(payoutUpdateSchema), adminController.updatePayout);
adminRoutes.get("/notifications/campaigns", validate(notificationCampaignQuerySchema), adminController.notificationCampaigns);
adminRoutes.post("/notifications/campaigns", validate(notificationCampaignCreateSchema), adminController.createNotificationCampaign);
adminRoutes.get("/notifications/campaigns/:id", adminController.notificationCampaignDetail);
adminRoutes.get("/courts/pending", adminController.pendingCourts);
adminRoutes.get("/courts", validate(adminCourtQuerySchema), adminController.courts);
adminRoutes.get("/courts/:id", adminController.courtDetail);
adminRoutes.patch("/courts/:id/admin", validate(adminCourtUpdateSchema), adminController.updateCourtAdmin);
adminRoutes.post("/courts/:id/request-update", validate(adminCourtRequestUpdateSchema), adminController.requestCourtUpdate);
adminRoutes.put("/courts/:id/approve", adminController.approveCourt);
adminRoutes.put("/courts/:id/reject", validate(rejectSchema), adminController.rejectCourt);
adminRoutes.get("/categories", adminController.categories);
adminRoutes.post("/categories", validate(categoryCreateSchema), adminController.createCategory);
adminRoutes.put("/categories/:id", validate(categoryUpdateSchema), adminController.updateCategory);
adminRoutes.delete("/categories/:id", adminController.deleteCategory);
adminRoutes.get("/reviews", adminController.reviews);
adminRoutes.put("/reviews/:id/hide", adminController.hideReview);
adminRoutes.put("/reviews/:id/show", adminController.showReview);
adminRoutes.delete("/reviews/:id", adminController.deleteReview);
adminRoutes.get("/reports", adminController.reports);
adminRoutes.put("/reports/:id/resolve", adminController.resolveReport);
adminRoutes.put("/reports/:id/reject", adminController.rejectReport);
adminRoutes.get("/statistics", adminController.statistics);
adminRoutes.get("/vouchers", validate(listQuerySchema), adminController.vouchers);
adminRoutes.put("/vouchers/:id/disable", validate(moderationSchema), adminController.disableVoucher);
adminRoutes.put("/vouchers/:id/activate", validate(moderationSchema), adminController.activateVoucher);
adminRoutes.get("/vouchers/:id", adminController.voucherDetail);
adminRoutes.post("/vouchers", adminController.createVoucher);
adminRoutes.put("/vouchers/:id", adminController.updateVoucher);
adminRoutes.get("/blogs/pending", validate(listQuerySchema), adminController.pendingBlogs);
adminRoutes.put("/blogs/:id/approve", validate(moderationSchema), adminController.approveBlog);
adminRoutes.put("/blogs/:id/reject", validate(rejectSchema), adminController.rejectBlog);
adminRoutes.put("/blogs/:id/hide", validate(moderationSchema), adminController.hideBlog);
adminRoutes.get("/tournaments/pending", validate(listQuerySchema), adminController.pendingTournaments);
adminRoutes.put("/tournaments/:id/approve", validate(moderationSchema), adminController.approveTournament);
adminRoutes.put("/tournaments/:id/reject", validate(rejectSchema), adminController.rejectTournament);
adminRoutes.get("/audit-logs", validate(listQuerySchema), adminController.auditLogs);
adminRoutes.get("/audit-logs/verify", adminController.verifyAuditLogs);
adminRoutes.get("/blockchain-logs", validate(listQuerySchema), adminController.blockchainLogs);
adminRoutes.put("/blockchain-logs/:id/retry", adminController.retryBlockchainLog);
