import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { withdrawalController } from "./withdrawal.controller.js";
import {
  createWithdrawalSchema,
  withdrawalQuerySchema,
  withdrawalActionSchema
} from "./withdrawal.validation.js";

const partnerRoutes = Router();
const adminRoutes = Router();

partnerRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerRoutes.post("/withdrawals", validate(createWithdrawalSchema), withdrawalController.create);
partnerRoutes.get("/withdrawals", validate(withdrawalQuerySchema), withdrawalController.listForPartner);

adminRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminRoutes.get("/withdrawals", validate(withdrawalQuerySchema), withdrawalController.listForAdmin);
adminRoutes.get("/withdrawals/summary", withdrawalController.summaryForAdminRoute);
adminRoutes.put("/withdrawals/:id/approve", withdrawalController.approve);
adminRoutes.put("/withdrawals/:id/reject", validate(withdrawalActionSchema), withdrawalController.reject);
adminRoutes.put("/withdrawals/:id/paid", withdrawalController.markPaid);

export { partnerRoutes as partnerWithdrawalRoutes, adminRoutes as adminWithdrawalRoutes };
