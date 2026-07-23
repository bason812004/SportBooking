import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { weeklyScheduleController } from "./weeklySchedule.controller.js";
import { weeklyScheduleQuerySchema } from "./weeklySchedule.validation.js";

export const weeklyScheduleRoutes = Router({ mergeParams: true });

weeklyScheduleRoutes.get("/", validate(weeklyScheduleQuerySchema), weeklyScheduleController.show);
