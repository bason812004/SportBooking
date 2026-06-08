import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { userController } from "./user.controller.js";
import { updateMeSchema } from "./user.validation.js";

export const userRoutes = Router();

userRoutes.use(authMiddleware, requireRole(UserRole.USER, UserRole.PARTNER, UserRole.ADMIN));
userRoutes.get("/me", userController.me);
userRoutes.put("/me", validate(updateMeSchema), userController.updateMe);
userRoutes.get("/me/bookings", requireRole(UserRole.USER), userController.bookings);
