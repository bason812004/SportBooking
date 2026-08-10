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

cashierRoutes.post("/bookings/:bookingId/services", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.USER, UserRole.ADMIN), asyncHandler(cashierController.addServiceToBooking));
cashierRoutes.patch("/bookings/:bookingId/services/:serviceId", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(cashierController.updateBookingServiceQuantity));
cashierRoutes.delete("/bookings/:bookingId/services/:serviceId", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(cashierController.removeBookingService));

cashierRoutes.post("/rentals/return", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(cashierController.returnRentalItem));
