import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { reviewController } from "../reviews/review.controller.js";
import { courtController } from "./court.controller.js";
import { availabilitySchema, courtListSchema } from "./court.validation.js";

export const courtRoutes = Router();

courtRoutes.get("/", validate(courtListSchema), courtController.list);
courtRoutes.get("/:id", courtController.detail);
courtRoutes.get("/:id/availability", validate(availabilitySchema), courtController.availability);
courtRoutes.get("/:id/reviews", reviewController.listByCourt);
