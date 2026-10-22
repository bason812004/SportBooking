import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { settlementController } from "./settlement.controller.js";
import { settlementIdParamsSchema, settlementQuerySchema } from "./settlement.validation.js";

export const partnerSettlementRoutes = Router();
partnerSettlementRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerSettlementRoutes.get("/", validate(settlementQuerySchema), settlementController.listMine);
partnerSettlementRoutes.get("/summary", validate(settlementQuerySchema), settlementController.summaryMine);
partnerSettlementRoutes.get("/:id", validate(settlementIdParamsSchema), settlementController.detailMine);

export const adminSettlementRoutes = Router();
adminSettlementRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminSettlementRoutes.get("/", validate(settlementQuerySchema), settlementController.adminList);
adminSettlementRoutes.get("/summary", validate(settlementQuerySchema), settlementController.adminSummary);
adminSettlementRoutes.put("/:id/settle", validate(settlementIdParamsSchema), settlementController.adminSettle);
adminSettlementRoutes.put("/:id/cancel", validate(settlementIdParamsSchema), settlementController.adminCancel);
