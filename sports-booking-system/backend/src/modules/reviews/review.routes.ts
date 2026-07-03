import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { reviewController } from "./review.controller.js";
import { createReviewSchema } from "./review.validation.js";

export const reviewRoutes = Router();

reviewRoutes.post("/", authMiddleware, validate(createReviewSchema), reviewController.create);
