import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { reportController } from "./report.controller.js";
import { createReportSchema, reportReplySchema, reportThreadSchema } from "./report.validation.js";

export const reportRoutes = Router();

reportRoutes.post("/", authMiddleware, requireRole(UserRole.USER), validate(createReportSchema), reportController.create);
// The reporter's own report and its conversation with the admins.
reportRoutes.get("/:id", authMiddleware, requireRole(UserRole.USER), validate(reportThreadSchema), reportController.thread);
reportRoutes.post("/:id/messages", authMiddleware, requireRole(UserRole.USER), validate(reportReplySchema), reportController.reply);
