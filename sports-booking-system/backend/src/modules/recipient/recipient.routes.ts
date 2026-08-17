import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { recipientController } from "./recipient.controller.js";
import { bookingQuerySchema, calendarQuerySchema } from "../partner/partner.validation.js";
import {
  blockIdParamSchema,
  bookingExtendSchema,
  courtSurfaceStatusSchema,
  customerIdParamSchema,
  customerLookupQuerySchema,
  lockSlotSchema,
  operationsQuerySchema,
  paymentIdParamSchema,
  recurringWalkInBookingSchema,
  surfaceAvailabilityQuerySchema,
  walkInBookingOrderSchema,
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
recipientRoutes.post("/court-surfaces/:id/lock", validate(lockSlotSchema), recipientController.lockSurfaceSlot);
recipientRoutes.post("/availability-blocks/:id/unlock", validate(blockIdParamSchema), recipientController.unlockSurfaceSlot);
recipientRoutes.get("/operations", validate(operationsQuerySchema), recipientController.operations);
recipientRoutes.post("/bookings/:id/extend", validate(bookingExtendSchema), recipientController.extendBooking);
recipientRoutes.get("/customers/lookup", validate(customerLookupQuerySchema), recipientController.lookupCustomers);
recipientRoutes.get("/customers/:id/history", validate(customerIdParamSchema), recipientController.customerHistory);
recipientRoutes.post("/operations/walk-in-booking", validate(walkInBookingSchema), recipientController.createWalkInBooking);
recipientRoutes.post(
  "/operations/walk-in-booking-order",
  validate(walkInBookingOrderSchema),
  recipientController.createWalkInBookingOrder
);
recipientRoutes.post(
  "/operations/recurring-walk-in-booking",
  validate(recurringWalkInBookingSchema),
  recipientController.createRecurringWalkInBooking
);
recipientRoutes.post("/bookings/:id/check-in", recipientController.checkInBooking);
recipientRoutes.post("/bookings/:id/early-check-out", recipientController.earlyCheckOutBooking);
recipientRoutes.get("/payments/:id/status", validate(paymentIdParamSchema), recipientController.paymentStatus);
recipientRoutes.post("/payments/:id/confirm", validate(paymentIdParamSchema), recipientController.confirmWalkInPayment);
