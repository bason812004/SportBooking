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
  listTransactionsSchema,
  rentalHistorySchema,
  salesHistorySchema,
  purchaseOrderIdParams,
  receivePurchaseOrderSchema,
  updatePurchaseOrderSchema
} from "./inventory.validation.js";

export const inventoryRoutes = Router();

inventoryRoutes.use(authMiddleware);

// Staff only look at their court's stock (what the counter sold is taken off automatically); buying stock in —
// suppliers, reorder suggestions, purchase orders from draft to receipt — and correcting counts are the partner's.
const canView = requireRole(UserRole.PARTNER, UserRole.RECIPIENT);
const canManage = requireRole(UserRole.PARTNER);
// What the counter sold and rented out at the staff member's own court (the partner reads the stock ledger instead).
const staffOnly = requireRole(UserRole.RECIPIENT);

inventoryRoutes.get("/summary", canView, asyncHandler(inventoryController.getInventorySummary));
inventoryRoutes.get("/alerts", canView, asyncHandler(inventoryController.getLowStockAlerts));
inventoryRoutes.get("/reorder-suggestions", canManage, asyncHandler(inventoryController.getReorderSuggestions));
inventoryRoutes.post("/adjust", canManage, validate(adjustStockSchema), asyncHandler(inventoryController.adjustStock));
inventoryRoutes.get("/transactions", canManage, validate(listTransactionsSchema), asyncHandler(inventoryController.getTransactions));
inventoryRoutes.get("/sales", staffOnly, validate(salesHistorySchema), asyncHandler(inventoryController.getSalesHistory));
inventoryRoutes.get("/rentals", staffOnly, validate(rentalHistorySchema), asyncHandler(inventoryController.getRentalHistory));
inventoryRoutes.get("/suppliers", canManage, asyncHandler(inventoryController.listSuppliers));
inventoryRoutes.post("/suppliers", canManage, validate(createSupplierSchema), asyncHandler(inventoryController.createSupplier));
inventoryRoutes.get("/purchase-orders", canManage, validate(listPurchaseOrdersSchema), asyncHandler(inventoryController.listPurchaseOrders));
inventoryRoutes.post("/purchase-orders", canManage, validate(createPurchaseOrderSchema), asyncHandler(inventoryController.createPurchaseOrder));
inventoryRoutes.post(
  "/purchase-orders/from-suggestions",
  canManage,
  validate(draftFromSuggestionsSchema),
  asyncHandler(inventoryController.createDraftFromSuggestions)
);
inventoryRoutes.put("/purchase-orders/:id", canManage, validate(updatePurchaseOrderSchema), asyncHandler(inventoryController.updatePurchaseOrder));
inventoryRoutes.post("/purchase-orders/:id/order", canManage, validate(purchaseOrderIdParams), asyncHandler(inventoryController.orderPurchaseOrder));
inventoryRoutes.post("/purchase-orders/:id/receive", canManage, validate(receivePurchaseOrderSchema), asyncHandler(inventoryController.receivePurchaseOrder));
inventoryRoutes.post("/purchase-orders/:id/cancel", canManage, validate(purchaseOrderIdParams), asyncHandler(inventoryController.cancelPurchaseOrder));
