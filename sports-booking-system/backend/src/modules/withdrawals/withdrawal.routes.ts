import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { withdrawalController } from "./withdrawal.controller.js";
import {
  createWithdrawalSchema,
  withdrawalActionSchema,
  withdrawalIdParamsSchema,
  withdrawalPaidSchema,
  withdrawalQuerySchema,
  withdrawalRejectSchema
} from "./withdrawal.validation.js";

export const partnerWithdrawalRoutes = Router();
partnerWithdrawalRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerWithdrawalRoutes.post("/", validate(createWithdrawalSchema), withdrawalController.create);
partnerWithdrawalRoutes.get("/", validate(withdrawalQuerySchema), withdrawalController.listMine);
partnerWithdrawalRoutes.put("/:id/cancel", validate(withdrawalIdParamsSchema), withdrawalController.cancelMine);

export const adminWithdrawalRoutes = Router();
adminWithdrawalRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminWithdrawalRoutes.get("/", validate(withdrawalQuerySchema), withdrawalController.adminList);
adminWithdrawalRoutes.get("/summary", withdrawalController.adminSummary);
adminWithdrawalRoutes.put("/:id/approve", validate(withdrawalActionSchema), withdrawalController.approve);
adminWithdrawalRoutes.put("/:id/reject", validate(withdrawalRejectSchema), withdrawalController.reject);
adminWithdrawalRoutes.put("/:id/paid", validate(withdrawalPaidSchema), withdrawalController.markPaid);
