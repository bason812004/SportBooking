import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { recipientController } from "./recipient.controller.js";
import { bookingQuerySchema, calendarQuerySchema } from "../partner/partner.validation.js";

export const recipientRoutes = Router();

recipientRoutes.use(authMiddleware, requireRole("RECIPIENT" as any));

recipientRoutes.get("/dashboard", recipientController.dashboard);
recipientRoutes.get("/bookings", validate(bookingQuerySchema), recipientController.bookings);
recipientRoutes.put("/bookings/:id/confirm", recipientController.confirm);
recipientRoutes.put("/bookings/:id/reject", recipientController.reject);
recipientRoutes.put("/bookings/:id/complete", recipientController.complete);
recipientRoutes.put("/bookings/:id/no-show", recipientController.noShow);
recipientRoutes.get("/calendar", validate(calendarQuerySchema), recipientController.calendar);
