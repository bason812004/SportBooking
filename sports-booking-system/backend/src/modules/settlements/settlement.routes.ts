import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { settlementController } from "./settlement.controller.js";
import {
  settlementPartnerQuerySchema,
  settlementAdminQuerySchema,
  settlementActionSchema
} from "./settlement.validation.js";

const partnerRoutes = Router();
const adminRoutes = Router();

partnerRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerRoutes.get("/wallet", settlementController.listForPartner);
partnerRoutes.get("/settlements", validate(settlementPartnerQuerySchema), settlementController.listForPartner);
partnerRoutes.get("/settlements/:id", settlementController.detailForPartner);
partnerRoutes.get("/settlements/summary", settlementController.summaryForPartner);

adminRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminRoutes.get("/settlements", validate(settlementAdminQuerySchema), settlementController.listForAdmin);
adminRoutes.get("/settlements/summary", settlementController.summaryForAdminRoute);
adminRoutes.put("/settlements/:id/settle", settlementController.settleForAdmin);
adminRoutes.put("/settlements/:id/cancel", validate(settlementActionSchema), settlementController.cancelForAdmin);

export { partnerRoutes as partnerSettlementRoutes, adminRoutes as adminSettlementRoutes };
