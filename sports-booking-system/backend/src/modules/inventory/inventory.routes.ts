import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { inventoryController } from "./inventory.controller.js";
import {
  adjustStockSchema,
  createPurchaseOrderSchema,
  createSupplierSchema,
  draftFromSuggestionsSchema,
  listPurchaseOrdersSchema,
  purchaseOrderIdParams,
  receivePurchaseOrderSchema,
  updatePurchaseOrderSchema
} from "./inventory.validation.js";

export const inventoryRoutes = Router();

inventoryRoutes.use(authMiddleware);

const canView = requireRole(UserRole.PARTNER, UserRole.RECIPIENT);
const canManage = requireRole(UserRole.PARTNER);
// Purchase-order steps a court's receptionist also performs (propose a draft, count goods in, withdraw a draft);
// the service narrows what each role may do and pins a receptionist to their own court.
const canOperate = requireRole(UserRole.PARTNER, UserRole.RECIPIENT);

inventoryRoutes.get("/summary", canView, asyncHandler(inventoryController.getInventorySummary));
inventoryRoutes.get("/alerts", canView, asyncHandler(inventoryController.getLowStockAlerts));
inventoryRoutes.get("/reorder-suggestions", canView, asyncHandler(inventoryController.getReorderSuggestions));
inventoryRoutes.post("/adjust", canManage, validate(adjustStockSchema), asyncHandler(inventoryController.adjustStock));
inventoryRoutes.get("/transactions", canView, asyncHandler(inventoryController.getTransactions));
inventoryRoutes.get("/suppliers", canView, asyncHandler(inventoryController.listSuppliers));
inventoryRoutes.post("/suppliers", canManage, validate(createSupplierSchema), asyncHandler(inventoryController.createSupplier));
inventoryRoutes.get("/purchase-orders", canView, validate(listPurchaseOrdersSchema), asyncHandler(inventoryController.listPurchaseOrders));
inventoryRoutes.post("/purchase-orders", canOperate, validate(createPurchaseOrderSchema), asyncHandler(inventoryController.createPurchaseOrder));
inventoryRoutes.post(
  "/purchase-orders/from-suggestions",
  canOperate,
  validate(draftFromSuggestionsSchema),
  asyncHandler(inventoryController.createDraftFromSuggestions)
);
inventoryRoutes.put("/purchase-orders/:id", canOperate, validate(updatePurchaseOrderSchema), asyncHandler(inventoryController.updatePurchaseOrder));
inventoryRoutes.post("/purchase-orders/:id/order", canManage, validate(purchaseOrderIdParams), asyncHandler(inventoryController.orderPurchaseOrder));
inventoryRoutes.post("/purchase-orders/:id/receive", canOperate, validate(receivePurchaseOrderSchema), asyncHandler(inventoryController.receivePurchaseOrder));
inventoryRoutes.post("/purchase-orders/:id/cancel", canOperate, validate(purchaseOrderIdParams), asyncHandler(inventoryController.cancelPurchaseOrder));
