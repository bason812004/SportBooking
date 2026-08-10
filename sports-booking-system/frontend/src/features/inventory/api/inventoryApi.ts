import { api } from "../../../lib/axios";
import type { ApiResponse } from "../../../types/api";

export interface InventoryItem {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  unit: string;
  quantity: number;
  minimumStock: number;
  costPrice: number;
  price: number;
  stockValue: number;
  status: "NORMAL" | "LOW_STOCK" | "OUT_OF_STOCK";
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

export interface PurchaseOrder {
  id: string;
  partnerId: string;
  supplierId?: string | null;
  orderCode: string;
  totalAmount: number;
  status: string;
  note?: string | null;
  createdAt: string;
  supplier?: Supplier | null;
  items: Array<{
    id: string;
    serviceId: string;
    quantity: number;
    unitCost: number;
    totalPrice: number;
    service: { name: string; unit: string };
  }>;
}

export const inventoryApi = {
  async getSummary() {
    const res = await api.get<ApiResponse<{ summary: InventorySummary; items: InventoryItem[] }>>("/partner/inventory/summary");
    return res.data.data;
  },

  async adjustStock(data: { serviceId: string; type: string; quantity: number; unitCost?: number; note?: string }) {
    const res = await api.post<ApiResponse<any>>("/partner/inventory/adjust", data);
    return res.data.data;
  },

  async getTransactions(limit = 50) {
    const res = await api.get<ApiResponse<InventoryTransaction[]>>("/partner/inventory/transactions", { params: { limit } });
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

  async getPurchaseOrders() {
    const res = await api.get<ApiResponse<PurchaseOrder[]>>("/partner/inventory/purchase-orders");
    return res.data.data;
  },

  async createPurchaseOrder(data: { supplierId?: string; note?: string; items: Array<{ serviceId: string; quantity: number; unitCost: number }> }) {
    const res = await api.post<ApiResponse<PurchaseOrder>>("/partner/inventory/purchase-orders", data);
    return res.data.data;
  }
};
