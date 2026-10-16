export type InventoryTxType = "IMPORT" | "SALE" | "RENTAL_OUT" | "RENTAL_IN" | "ADJUSTMENT" | "DAMAGED" | "LOST";

export const INVENTORY_TX_TYPES = ["IMPORT", "SALE", "RENTAL_OUT", "RENTAL_IN", "ADJUSTMENT", "DAMAGED", "LOST"] as const;

/**
 * DRAFT -> ORDERED -> COMPLETED (goods received, stock added), or DRAFT/ORDERED -> CANCELLED.
 * COMPLETED keeps its legacy name so purchase orders created before this flow need no migration.
 */
export const PURCHASE_ORDER_STATUSES = ["DRAFT", "ORDERED", "COMPLETED", "CANCELLED"] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

/** Statuses a purchase order may be created in; CANCELLED is only reachable via a transition. */
export const PURCHASE_ORDER_INITIAL_STATUSES = ["DRAFT", "ORDERED", "COMPLETED"] as const;
export type PurchaseOrderInitialStatus = (typeof PURCHASE_ORDER_INITIAL_STATUSES)[number];

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

export interface UpdatePurchaseOrderInput {
  supplierId?: string;
  note?: string;
  items: PurchaseOrderItemInput[];
}

export interface CreatePurchaseOrderInput extends UpdatePurchaseOrderInput {
  /** The court (cụm sân) being restocked; when omitted it is inferred from the items, which must all share one court. */
  courtId?: string;
  status?: PurchaseOrderInitialStatus;
}

export interface ReceivePurchaseOrderInput {
  /** Counted quantity per line; a line that is not listed is taken as received in full. */
  items?: Array<{ itemId: string; receivedQuantity: number }>;
  note?: string;
}

export interface PurchaseOrderListFilter {
  courtId?: string;
  status?: PurchaseOrderStatus;
}

/**
 * Who is acting on stock and where. A partner works across all of their courts (courtId = null);
 * a receptionist is pinned to the one court they manage.
 */
export interface InventoryActor {
  userId: string;
  role: "PARTNER" | "RECIPIENT";
  partnerId: string;
  courtId: string | null;
}

/** The part of the actor a purchase-order write is scoped by. */
export type PurchaseOrderScope = Pick<InventoryActor, "userId" | "partnerId" | "courtId">;
