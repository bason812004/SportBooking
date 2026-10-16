import { api } from "../../../lib/axios";
import type { ApiResponse } from "../../../types/api";

export interface InventoryItem {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  /** Each court keeps its own services row and stock for the same product name. */
  courtId?: string | null;
  courtName?: string | null;
  imageUrl?: string | null;
  unit: string;
  quantity: number;
  minimumStock: number;
  costPrice: number;
  price: number;
  stockValue: number;
  status: "NORMAL" | "LOW_STOCK" | "OUT_OF_STOCK";
}

export interface StockAdjustmentResult {
  serviceId: string;
  previousQuantity: number;
  /** Server-computed stock after the adjustment — patch the row with this, don't recompute it. */
  newQuantity: number;
}

export interface InventorySummary {
  totalProducts: number;
  totalItems: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface InventoryTransaction {
  id: string;
  serviceId: string;
  type: "IMPORT" | "SALE" | "RENTAL_OUT" | "RENTAL_IN" | "ADJUSTMENT" | "DAMAGED" | "LOST";
  quantity: number;
  unitCost: number;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdAt: string;
  service: {
    id: string;
    name: string;
    unit: string;
    category?: { name: string } | null;
  };
}

export interface Supplier {
  id: string;
  partnerId: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

/**
 * DRAFT (a court's receptionist proposes, or the partner drafts) -> ORDERED (partner approves and orders)
 * -> COMPLETED (goods counted in at the court, stock added by the received quantity); DRAFT/ORDERED -> CANCELLED.
 */
export type PurchaseOrderStatus = "DRAFT" | "ORDERED" | "COMPLETED" | "CANCELLED";

export interface PurchaseOrderInput {
  supplierId?: string;
  note?: string;
  items: Array<{ serviceId: string; quantity: number; unitCost: number }>;
}

export interface PurchaseOrderPerson {
  id: string;
  fullName: string;
}

export interface PurchaseOrderItem {
  id: string;
  serviceId: string;
  quantity: number;
  /** Counted on receipt; null until the order is received. */
  receivedQuantity: number | null;
  unitCost: number;
  totalPrice: number;
  service: { name: string; unit: string };
}

export interface PurchaseOrder {
  id: string;
  partnerId: string;
  /** Every order restocks one court (cụm sân); null only on orders created before courts were tracked. */
  courtId: string | null;
  court?: { id: string; name: string; address: string } | null;
  supplierId?: string | null;
  orderCode: string;
  totalAmount: number;
  /** Value of what actually arrived; set once the order is received. */
  receivedAmount: number | null;
  status: PurchaseOrderStatus;
  note?: string | null;
  receiveNote?: string | null;
  createdAt: string;
  updatedAt: string;
  orderedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdBy?: PurchaseOrderPerson | null;
  orderedBy?: PurchaseOrderPerson | null;
  receivedBy?: PurchaseOrderPerson | null;
  cancelledBy?: PurchaseOrderPerson | null;
  supplier?: Supplier | null;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderReceipt {
  /** Lines left out are taken as received in full. */
  items?: Array<{ itemId: string; receivedQuantity: number }>;
  note?: string;
}

export interface InventoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LowStockAlert {
  serviceId: string;
  serviceName: string;
  unit: string;
  quantity: number;
  minimumStock: number;
  status: "LOW_STOCK" | "OUT_OF_STOCK";
}

export interface ReorderSuggestion {
  serviceId: string;
  serviceName: string;
  unit: string;
  courtId: string | null;
  courtName: string | null;
  costPrice: number;
  quantity: number;
  minimumStock: number;
  dailyRate: number | null;
  daysRemaining: number | null;
  suggestedQuantity: number;
  status: "REORDER_SOON" | "INSUFFICIENT_DATA";
}

export const inventoryApi = {
  async getSummary(params?: { page?: number; limit?: number; status?: string; search?: string; categoryId?: string; courtId?: string; sortBy?: string; sortOrder?: string }) {
    const res = await api.get<ApiResponse<{ summary: InventorySummary; items: InventoryItem[]; pagination: InventoryPagination }>>(
      "/partner/inventory/summary",
      { params }
    );
    return res.data.data;
  },

  // `courtId` narrows a partner's view to one court; a receptionist always gets their own court.
  async getLowStockAlerts(limit?: number, courtId?: string) {
    const res = await api.get<ApiResponse<LowStockAlert[]>>("/partner/inventory/alerts", { params: { limit, courtId } });
    return res.data.data;
  },

  async getReorderSuggestions(courtId?: string) {
    const res = await api.get<ApiResponse<ReorderSuggestion[]>>("/partner/inventory/reorder-suggestions", { params: { courtId } });
    return res.data.data;
  },

  async adjustStock(data: { serviceId: string; type: string; quantity: number; unitCost?: number; note?: string }) {
    const res = await api.post<ApiResponse<StockAdjustmentResult>>("/partner/inventory/adjust", data);
    return res.data.data;
  },

  async getTransactions(limit = 50, courtId?: string) {
    const res = await api.get<ApiResponse<InventoryTransaction[]>>("/partner/inventory/transactions", { params: { limit, courtId } });
    return res.data.data;
  },

  async getSuppliers() {
    const res = await api.get<ApiResponse<Supplier[]>>("/partner/inventory/suppliers");
    return res.data.data;
  },

  async createSupplier(data: { name: string; contactName?: string; phone?: string; email?: string; address?: string }) {
    const res = await api.post<ApiResponse<Supplier>>("/partner/inventory/suppliers", data);
    return res.data.data;
  },

  async getPurchaseOrders(params?: { courtId?: string; status?: PurchaseOrderStatus }) {
    const res = await api.get<ApiResponse<PurchaseOrder[]>>("/partner/inventory/purchase-orders", { params });
    return res.data.data;
  },

  /** Without `courtId` the court is inferred from the products, which must all belong to one court. A receptionist's order is always a draft. */
  async createPurchaseOrder(data: PurchaseOrderInput & { courtId?: string; status?: Exclude<PurchaseOrderStatus, "CANCELLED"> }) {
    const res = await api.post<ApiResponse<PurchaseOrder>>("/partner/inventory/purchase-orders", data);
    return res.data.data;
  },

  /** Gathers one court's reorder suggestions into a single draft for review. */
  async createDraftFromSuggestions(courtId?: string) {
    const res = await api.post<ApiResponse<PurchaseOrder>>("/partner/inventory/purchase-orders/from-suggestions", { courtId });
    return res.data.data;
  },

  /** Only allowed while the order is still a draft. */
  async updatePurchaseOrder(id: string, data: PurchaseOrderInput) {
    const res = await api.put<ApiResponse<PurchaseOrder>>(`/partner/inventory/purchase-orders/${id}`, data);
    return res.data.data;
  },

  async orderPurchaseOrder(id: string) {
    const res = await api.post<ApiResponse<PurchaseOrder>>(`/partner/inventory/purchase-orders/${id}/order`);
    return res.data.data;
  },

  /** Records the counted goods; this is the step that adds them to stock (by the received quantity). */
  async receivePurchaseOrder(id: string, receipt: PurchaseOrderReceipt = {}) {
    const res = await api.post<ApiResponse<PurchaseOrder>>(`/partner/inventory/purchase-orders/${id}/receive`, receipt);
    return res.data.data;
  },

  async cancelPurchaseOrder(id: string) {
    const res = await api.post<ApiResponse<PurchaseOrder>>(`/partner/inventory/purchase-orders/${id}/cancel`);
    return res.data.data;
  }
};
