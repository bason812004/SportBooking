import { validate } from "../../middlewares/validate.middleware.js";
import { addServiceSchema, bookingParamsSchema, returnRentalSchema, updateServiceSchema } from "./cashier.validation.js";
import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { cashierController } from "./cashier.controller.js";

export const cashierRoutes = Router();

cashierRoutes.use(authMiddleware);

cashierRoutes.get("/bookings/active", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(cashierController.getActiveBookings));
cashierRoutes.get("/bookings/:bookingId", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.USER, UserRole.ADMIN), asyncHandler(cashierController.getBookingDetailForCashier));

cashierRoutes.post("/bookings/:bookingId/services", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.USER, UserRole.ADMIN), validate(addServiceSchema), asyncHandler(cashierController.addServiceToBooking));
cashierRoutes.patch("/bookings/:bookingId/services/:serviceId", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), validate(updateServiceSchema), asyncHandler(cashierController.updateBookingServiceQuantity));
cashierRoutes.delete("/bookings/:bookingId/services/:serviceId", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(cashierController.removeBookingService));

cashierRoutes.post("/bookings/:bookingId/check-in", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(cashierController.checkInBooking));
cashierRoutes.post("/rentals/return", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), validate(returnRentalSchema), asyncHandler(cashierController.returnRentalItem));
// Ends a checked-in session that owes nothing (with money owed, the payment finishes it).
cashierRoutes.post("/bookings/:bookingId/finish", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), validate(bookingParamsSchema), asyncHandler(cashierController.finishSession));
// Locked at the counter, an invoice's services stop changing on every device until it is unlocked.
cashierRoutes.post("/bookings/:bookingId/invoice-lock", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), validate(bookingParamsSchema), asyncHandler(cashierController.lockInvoice));
cashierRoutes.delete("/bookings/:bookingId/invoice-lock", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), validate(bookingParamsSchema), asyncHandler(cashierController.unlockInvoice));
