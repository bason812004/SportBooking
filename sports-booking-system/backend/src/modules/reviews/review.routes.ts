import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { reviewController } from "./review.controller.js";
import { createReviewSchema } from "./review.validation.js";

export const reviewRoutes = Router();

reviewRoutes.post("/", authMiddleware, requireRole(UserRole.USER), validate(createReviewSchema), reviewController.create);
