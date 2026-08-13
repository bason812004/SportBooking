import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { inventoryController } from "./inventory.controller.js";

export const inventoryRoutes = Router();

inventoryRoutes.use(authMiddleware);

const canView = requireRole(UserRole.PARTNER, UserRole.RECIPIENT);
const canManage = requireRole(UserRole.PARTNER);

inventoryRoutes.get("/summary", canView, asyncHandler(inventoryController.getInventorySummary));
inventoryRoutes.post("/adjust", canManage, asyncHandler(inventoryController.adjustStock));
inventoryRoutes.get("/transactions", canView, asyncHandler(inventoryController.getTransactions));
inventoryRoutes.get("/suppliers", canView, asyncHandler(inventoryController.listSuppliers));
inventoryRoutes.post("/suppliers", canManage, asyncHandler(inventoryController.createSupplier));
inventoryRoutes.get("/purchase-orders", canView, asyncHandler(inventoryController.listPurchaseOrders));
inventoryRoutes.post("/purchase-orders", canManage, asyncHandler(inventoryController.createPurchaseOrder));
