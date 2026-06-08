import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { reportController } from "./report.controller.js";
import { createReportSchema } from "./report.validation.js";

export const reportRoutes = Router();

reportRoutes.post("/", authMiddleware, requireRole(UserRole.USER), validate(createReportSchema), reportController.create);
