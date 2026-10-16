import { ForbiddenError, ValidationError } from "../../shared/errors/AppError.js";
import { inventoryRepository } from "./inventory.repository.js";
import type {
  AdjustStockInput,
  CreatePurchaseOrderInput,
  CreateSupplierInput,
  InventoryActor,
  PurchaseOrderListFilter,
  PurchaseOrderStatus,
  ReceivePurchaseOrderInput,
  UpdatePurchaseOrderInput
} from "./inventory.types.js";

type Role = InventoryActor["role"];

/**
 * Purchase order lifecycle per court: the court's receptionist proposes (DRAFT), the partner approves
 * and orders (ORDERED), and whoever is on site counts the goods in (COMPLETED). Stock only changes on
 * receipt; cancelling never touches it, and COMPLETED/CANCELLED are final (undoing a receipt would need
 * a separate stock-return flow). `from` lists the statuses each role may start the transition from.
 */
const PURCHASE_ORDER_TRANSITIONS: Record<
  "order" | "receive" | "cancel",
  { to: PurchaseOrderStatus; from: Record<Role, readonly PurchaseOrderStatus[]>; action: Record<Role, string> }
> = {
  order: {
    to: "ORDERED",
    from: { PARTNER: ["DRAFT"], RECIPIENT: [] },
    action: { PARTNER: "đặt hàng", RECIPIENT: "đặt hàng" }
  },
  receive: {
    to: "COMPLETED",
    from: { PARTNER: ["DRAFT", "ORDERED"], RECIPIENT: ["ORDERED"] },
    action: { PARTNER: "nhận hàng", RECIPIENT: "nhận hàng (đơn cần được đối tác duyệt đặt hàng trước)" }
  },
  cancel: {
    to: "CANCELLED",
    from: { PARTNER: ["DRAFT", "ORDERED"], RECIPIENT: ["DRAFT"] },
    action: { PARTNER: "hủy", RECIPIENT: "hủy (lễ tân chỉ rút được đề xuất còn ở trạng thái nháp)" }
  }
};

function transition(actor: InventoryActor, id: string, name: keyof typeof PURCHASE_ORDER_TRANSITIONS, receipt?: ReceivePurchaseOrderInput) {
  const rule = PURCHASE_ORDER_TRANSITIONS[name];
  const from = rule.from[actor.role];
  if (from.length === 0) throw new ForbiddenError("Chỉ đối tác mới được duyệt đặt hàng");
  return inventoryRepository.transitionPurchaseOrder(actor, id, from, rule.to, rule.action[actor.role], receipt);
}

export const inventoryService = {
  async getInventorySummary(
    partnerId: string,
    options?: { page?: number; limit?: number; status?: string; search?: string; categoryId?: string; courtId?: string; sortBy?: string; sortOrder?: string }
  ) {
    return inventoryRepository.getInventorySummary(partnerId, options);
  },

  async getLowStockAlerts(partnerId: string, limit?: number, courtId?: string) {
    return inventoryRepository.getLowStockAlerts(partnerId, limit, courtId);
  },

  async getReorderSuggestions(partnerId: string, courtId?: string) {
    return inventoryRepository.getReorderSuggestions(partnerId, { courtId });
  },

  async adjustStock(partnerId: string, data: AdjustStockInput) {
    if (data.quantity < 0) throw new ValidationError("Số lượng không được âm");
    return inventoryRepository.adjustStock(partnerId, data);
  },

  async getTransactions(partnerId: string, limit?: number, courtId?: string) {
    return inventoryRepository.getTransactions(partnerId, limit, courtId);
  },

  async listSuppliers(partnerId: string) {
    return inventoryRepository.listSuppliers(partnerId);
  },

  async createSupplier(partnerId: string, data: CreateSupplierInput) {
    return inventoryRepository.createSupplier(partnerId, data);
  },

  // A receptionist can only propose a draft for their own court; approving and ordering is the partner's call.
  async createPurchaseOrder(actor: InventoryActor, data: CreatePurchaseOrderInput) {
    const input: CreatePurchaseOrderInput = actor.role === "RECIPIENT" ? { ...data, status: "DRAFT", courtId: actor.courtId! } : data;
    return inventoryRepository.createPurchaseOrder(actor.partnerId, actor.userId, input);
  },

  /** Gathers every reorder suggestion of one court into a single draft for a person to review and order. */
  async createDraftFromSuggestions(actor: InventoryActor, courtId?: string) {
    const targetCourtId = actor.courtId ?? courtId;
    if (!targetCourtId) throw new ValidationError("Vui lòng chọn cụm sân cần tạo đơn nhập");
    const suggestions = await inventoryRepository.getReorderSuggestions(actor.partnerId, { courtId: targetCourtId });
    if (suggestions.length === 0) throw new ValidationError("Cụm sân này chưa có mặt hàng nào cần nhập thêm");
    return inventoryRepository.createPurchaseOrder(actor.partnerId, actor.userId, {
      courtId: targetCourtId,
      status: "DRAFT",
      note: "Tạo từ gợi ý nhập hàng",
      items: suggestions.map((s) => ({ serviceId: s.serviceId, quantity: s.suggestedQuantity, unitCost: s.costPrice }))
    });
  },

  async updatePurchaseOrder(actor: InventoryActor, id: string, data: UpdatePurchaseOrderInput) {
    return inventoryRepository.updatePurchaseOrder(actor, id, data);
  },

  async orderPurchaseOrder(actor: InventoryActor, id: string) {
    return transition(actor, id, "order");
  },

  async receivePurchaseOrder(actor: InventoryActor, id: string, receipt?: ReceivePurchaseOrderInput) {
    return transition(actor, id, "receive", receipt);
  },

  async cancelPurchaseOrder(actor: InventoryActor, id: string) {
    return transition(actor, id, "cancel");
  },

  async listPurchaseOrders(actor: InventoryActor, filter: PurchaseOrderListFilter = {}) {
    return inventoryRepository.listPurchaseOrders(actor.partnerId, { ...filter, courtId: actor.courtId ?? filter.courtId });
  }
};
