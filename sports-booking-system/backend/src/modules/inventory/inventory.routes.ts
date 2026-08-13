import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { inventoryController } from "./inventory.controller.js";

export const inventoryRoutes = Router();

inventoryRoutes.use(authMiddleware);
inventoryRoutes.use(requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN, UserRole.USER));

inventoryRoutes.get("/summary", asyncHandler(inventoryController.getInventorySummary));
inventoryRoutes.post("/adjust", asyncHandler(inventoryController.adjustStock));
inventoryRoutes.get("/transactions", asyncHandler(inventoryController.getTransactions));
inventoryRoutes.get("/suppliers", asyncHandler(inventoryController.listSuppliers));
inventoryRoutes.post("/suppliers", asyncHandler(inventoryController.createSupplier));
inventoryRoutes.get("/purchase-orders", asyncHandler(inventoryController.listPurchaseOrders));
inventoryRoutes.post("/purchase-orders", asyncHandler(inventoryController.createPurchaseOrder));
