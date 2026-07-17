import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { withdrawalController } from "./withdrawal.controller.js";
import { createWithdrawalSchema, withdrawalActionSchema, withdrawalQuerySchema } from "./withdrawal.validation.js";

export const partnerWithdrawalRoutes = Router();
partnerWithdrawalRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerWithdrawalRoutes.post("/", validate(createWithdrawalSchema), withdrawalController.create);
partnerWithdrawalRoutes.get("/", validate(withdrawalQuerySchema), withdrawalController.listMine);

export const adminWithdrawalRoutes = Router();
adminWithdrawalRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminWithdrawalRoutes.get("/", validate(withdrawalQuerySchema), withdrawalController.adminList);
adminWithdrawalRoutes.get("/summary", withdrawalController.adminSummary);
adminWithdrawalRoutes.put("/:id/approve", validate(withdrawalActionSchema), withdrawalController.approve);
adminWithdrawalRoutes.put("/:id/reject", validate(withdrawalActionSchema), withdrawalController.reject);
adminWithdrawalRoutes.put("/:id/paid", validate(withdrawalActionSchema), withdrawalController.markPaid);
