import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { checkoutController } from "./checkout.controller.js";

export const checkoutRoutes = Router();

checkoutRoutes.use(authMiddleware);

checkoutRoutes.get("/booking/:bookingId", asyncHandler(checkoutController.getCheckoutByBooking));
checkoutRoutes.post("/booking/:bookingId", asyncHandler(checkoutController.getCheckoutByBooking));
checkoutRoutes.post("/:checkoutId/payment", asyncHandler(checkoutController.processPayment));
checkoutRoutes.post("/payment", asyncHandler(checkoutController.processPayment));

checkoutRoutes.get("/partner/list", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(checkoutController.listCheckouts));
