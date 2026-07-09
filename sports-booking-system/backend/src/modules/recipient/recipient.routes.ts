import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { recipientController } from "./recipient.controller.js";
import { bookingQuerySchema, calendarQuerySchema } from "../partner/partner.validation.js";
import {
  bookingExtendSchema,
  courtSurfaceStatusSchema,
  operationsQuerySchema,
  paymentIdParamSchema,
  surfaceAvailabilityQuerySchema,
  walkInBookingSchema
} from "./recipient.validation.js";

export const recipientRoutes = Router();

recipientRoutes.use(authMiddleware, requireRole("RECIPIENT" as any));

recipientRoutes.get("/dashboard", recipientController.dashboard);
recipientRoutes.get("/bookings", validate(bookingQuerySchema), recipientController.bookings);
recipientRoutes.put("/bookings/:id/confirm", recipientController.confirm);
recipientRoutes.put("/bookings/:id/reject", recipientController.reject);
recipientRoutes.put("/bookings/:id/complete", recipientController.complete);
recipientRoutes.put("/bookings/:id/no-show", recipientController.noShow);
recipientRoutes.get("/calendar", validate(calendarQuerySchema), recipientController.calendar);
recipientRoutes.get("/court-surfaces", recipientController.courtSurfaces);
recipientRoutes.put("/court-surfaces/:id/status", validate(courtSurfaceStatusSchema), recipientController.updateCourtSurfaceStatus);
recipientRoutes.get("/court-surfaces/:id/availability", validate(surfaceAvailabilityQuerySchema), recipientController.surfaceAvailability);
recipientRoutes.get("/operations", validate(operationsQuerySchema), recipientController.operations);
recipientRoutes.post("/bookings/:id/extend", validate(bookingExtendSchema), recipientController.extendBooking);
recipientRoutes.post("/operations/walk-in-booking", validate(walkInBookingSchema), recipientController.createWalkInBooking);
recipientRoutes.post("/bookings/:id/early-check-in", recipientController.earlyCheckInBooking);
recipientRoutes.post("/bookings/:id/early-check-out", recipientController.earlyCheckOutBooking);
recipientRoutes.get("/payments/:id/status", validate(paymentIdParamSchema), recipientController.paymentStatus);
recipientRoutes.post("/payments/:id/confirm", validate(paymentIdParamSchema), recipientController.confirmWalkInPayment);
