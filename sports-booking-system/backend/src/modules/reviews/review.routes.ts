import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { reviewController } from "./review.controller.js";
import { createReviewSchema, deleteReviewSchema, updateReviewSchema } from "./review.validation.js";

export const reviewRoutes = Router();

reviewRoutes.post("/", authMiddleware, validate(createReviewSchema), reviewController.create);
reviewRoutes.put("/:id", authMiddleware, validate(updateReviewSchema), reviewController.update);
reviewRoutes.delete("/:id", authMiddleware, validate(deleteReviewSchema), reviewController.delete);
