import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { bookingController } from "./booking.controller.js";
import {
  addBookingServiceSchema,
  bookingCheckoutSchema,
  bookingQuoteSchema,
  cancelBookingSchema,
  createBookingSchema,
  updateBookingServiceSchema
} from "./booking.validation.js";

export const bookingRoutes = Router();

bookingRoutes.use(authMiddleware, requireRole(UserRole.USER, UserRole.ADMIN, UserRole.PARTNER, UserRole.RECIPIENT));
bookingRoutes.post("/quote", validate(bookingQuoteSchema), bookingController.quote);
bookingRoutes.post("/checkout", validate(bookingCheckoutSchema), bookingController.checkout);
bookingRoutes.post("/", validate(createBookingSchema), bookingController.create);
bookingRoutes.get("/:id", bookingController.detail);
bookingRoutes.put("/:id/cancel", validate(cancelBookingSchema), bookingController.cancel);

// Customer Bill and Additional Services Flow
bookingRoutes.get("/:id/bill", bookingController.getBill);
bookingRoutes.get("/:id/services", bookingController.getServices);
bookingRoutes.post("/:id/services", validate(addBookingServiceSchema), bookingController.addService);
bookingRoutes.patch("/:id/services/:serviceId", validate(updateBookingServiceSchema), bookingController.updateService);
bookingRoutes.delete("/:id/services/:serviceId", bookingController.removeService);
bookingRoutes.post("/:id/checkout", bookingController.checkoutBooking);

