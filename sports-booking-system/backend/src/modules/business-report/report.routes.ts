import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { adminReportController, partnerReportController, recipientReportController } from "./report.controller.js";
import {
  adminReportExportQuerySchema,
  adminReportRangeQuerySchema,
  reportBookingExportQuerySchema,
  reportCustomerExportQuerySchema,
  reportCustomerParamSchema,
  reportExportQuerySchema,
  reportRangeQuerySchema
} from "./report.validation.js";

export const adminReportRoutes = Router();
adminReportRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminReportRoutes.get("/overview", validate(adminReportRangeQuerySchema), adminReportController.overview);
adminReportRoutes.get("/revenue", validate(adminReportRangeQuerySchema), adminReportController.revenue);
adminReportRoutes.get("/bookings", validate(adminReportRangeQuerySchema), adminReportController.bookings);
adminReportRoutes.get("/services", validate(adminReportRangeQuerySchema), adminReportController.services);
adminReportRoutes.get("/breakdown", validate(reportRangeQuerySchema), adminReportController.breakdown);
adminReportRoutes.get("/export", validate(adminReportExportQuerySchema), adminReportController.export);
adminReportRoutes.get("/customer/:userId", validate(reportCustomerParamSchema), adminReportController.customer);
adminReportRoutes.get("/customer/:userId/export", validate(reportCustomerExportQuerySchema), adminReportController.exportCustomer);
adminReportRoutes.get("/booking/:bookingId/export", validate(reportBookingExportQuerySchema), adminReportController.exportBooking);

export const partnerReportRoutes = Router();
partnerReportRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerReportRoutes.get("/overview", validate(reportRangeQuerySchema), partnerReportController.overview);
partnerReportRoutes.get("/revenue", validate(reportRangeQuerySchema), partnerReportController.revenue);
partnerReportRoutes.get("/bookings", validate(reportRangeQuerySchema), partnerReportController.bookings);
partnerReportRoutes.get("/services", validate(reportRangeQuerySchema), partnerReportController.services);
partnerReportRoutes.get("/export", validate(reportExportQuerySchema), partnerReportController.export);

export const recipientReportRoutes = Router();
recipientReportRoutes.use(authMiddleware, requireRole(UserRole.RECIPIENT));
recipientReportRoutes.get("/overview", validate(reportRangeQuerySchema), recipientReportController.overview);
recipientReportRoutes.get("/revenue", validate(reportRangeQuerySchema), recipientReportController.revenue);
recipientReportRoutes.get("/bookings", validate(reportRangeQuerySchema), recipientReportController.bookings);
recipientReportRoutes.get("/services", validate(reportRangeQuerySchema), recipientReportController.services);
recipientReportRoutes.get("/export", validate(reportExportQuerySchema), recipientReportController.export);
