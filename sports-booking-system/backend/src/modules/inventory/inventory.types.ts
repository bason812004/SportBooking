export type InventoryTxType = "IMPORT" | "SALE" | "RENTAL_OUT" | "RENTAL_IN" | "ADJUSTMENT" | "DAMAGED" | "LOST";

export interface AdjustStockInput {
  serviceId: string;
  type: InventoryTxType;
  quantity: number;
  unitCost?: number;
  note?: string;
}

export interface CreateSupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface PurchaseOrderItemInput {
  serviceId: string;
  quantity: number;
  unitCost: number;
}

export interface CreatePurchaseOrderInput {
  supplierId?: string;
  note?: string;
  items: PurchaseOrderItemInput[];
}
