import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { bookingController } from "./booking.controller.js";
import { bookingCheckoutSchema, bookingQuoteSchema, cancelBookingSchema, createBookingSchema } from "./booking.validation.js";

export const bookingRoutes = Router();

bookingRoutes.use(authMiddleware, requireRole(UserRole.USER));
bookingRoutes.post("/quote", validate(bookingQuoteSchema), bookingController.quote);
bookingRoutes.post("/checkout", validate(bookingCheckoutSchema), bookingController.checkout);
bookingRoutes.post("/", validate(createBookingSchema), bookingController.create);
bookingRoutes.get("/:id", bookingController.detail);
bookingRoutes.put("/:id/cancel", validate(cancelBookingSchema), bookingController.cancel);
