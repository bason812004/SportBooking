import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { reviewController } from "./review.controller.js";
import { createReviewSchema, deleteReviewSchema, reviewEligibilitySchema, updateReviewSchema } from "./review.validation.js";

export const reviewRoutes = Router();

reviewRoutes.get("/eligibility", authMiddleware, validate(reviewEligibilitySchema), reviewController.eligibility);
// Only customers review, and only courts they played at (checked in reviewService.create).
reviewRoutes.post("/", authMiddleware, requireRole(UserRole.USER), validate(createReviewSchema), reviewController.create);
reviewRoutes.put("/:id", authMiddleware, validate(updateReviewSchema), reviewController.update);
reviewRoutes.delete("/:id", authMiddleware, validate(deleteReviewSchema), reviewController.delete);
