import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { bookingReminderController } from "./bookingReminder.controller.js";

export const adminBookingReminderRoutes = Router();
adminBookingReminderRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminBookingReminderRoutes.get("/", bookingReminderController.adminList);
