import { ForbiddenError, ValidationError } from "../../shared/errors/AppError.js";
import { inventoryRepository } from "./inventory.repository.js";
import { vietnamNow } from "../../shared/utils/time.js";
import { historyRange, likePattern, pageOf, paginationOf, type RentalHistoryStatus } from "./inventory.history.js";
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
 * Purchase order lifecycle per court, all of it the partner's (staff are not part of buying stock in; the counter's
 * sales are taken off stock automatically): a draft (DRAFT), ordered (ORDERED), goods counted in (COMPLETED). Stock
 * only changes on receipt; cancelling never touches it, and COMPLETED/CANCELLED are final (undoing a receipt would
 * need a separate stock-return flow). `from` lists the statuses each role may start the transition from.
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
    from: { PARTNER: ["DRAFT", "ORDERED"], RECIPIENT: [] },
    action: { PARTNER: "nhận hàng", RECIPIENT: "nhận hàng" }
  },
  cancel: {
    to: "CANCELLED",
    from: { PARTNER: ["DRAFT", "ORDERED"], RECIPIENT: [] },
    action: { PARTNER: "hủy", RECIPIENT: "hủy" }
  }
};

/** The court whose sales and rentals a staff member reads: theirs, whatever the request says. */
function staffCourt(actor: InventoryActor) {
  if (actor.role !== "RECIPIENT" || !actor.courtId) throw new ForbiddenError("Lịch sử bán & cho thuê dành cho nhân viên của sân");
  return actor.courtId;
}

/** Buying stock in is the partner's: staff only look at stock (refused here too, not only by the routes). */
function assertPartner(actor: InventoryActor) {
  if (actor.role !== "PARTNER") throw new ForbiddenError("Nhập hàng do đối tác thực hiện; nhân viên chỉ xem tồn kho");
}

function transition(actor: InventoryActor, id: string, name: keyof typeof PURCHASE_ORDER_TRANSITIONS, receipt?: ReceivePurchaseOrderInput) {
  assertPartner(actor);
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

  /** One page of the partner's stock ledger (their own products only), with optional filters. */
  async getTransactions(
    partnerId: string,
    query: { courtId?: string; type?: string; search?: string; from?: string; to?: string; page?: number; limit?: number } = {}
  ) {
    const page = pageOf(query.page, query.limit);
    const range = query.from || query.to ? historyRange(query.from, query.to, vietnamNow().date) : { from: undefined, to: undefined };
    const { items, total } = await inventoryRepository.transactionsPage(partnerId, {
      courtId: query.courtId,
      type: query.type,
      search: likePattern(query.search),
      from: range.from,
      to: range.to,
      limit: page.limit,
      offset: page.offset
    });
    return { items, pagination: paginationOf(total, page) };
  },

  /** What a staff member's court sold, by the day the bookings are played (today unless told otherwise). */
  async salesHistory(actor: InventoryActor, query: { from?: string; to?: string; search?: string; page?: number; limit?: number } = {}) {
    const courtId = staffCourt(actor);
    const page = pageOf(query.page, query.limit);
    const range = historyRange(query.from, query.to, vietnamNow().date);
    const { items, summary } = await inventoryRepository.salesPage(courtId, {
      from: range.from,
      to: range.to,
      search: likePattern(query.search),
      limit: page.limit,
      offset: page.offset
    });
    return { range, summary, items, pagination: paginationOf(summary.lines, page) };
  },

  /** A staff member's court's rental pieces: out with customers now by default, or by the day they went out. */
  async rentalHistory(
    actor: InventoryActor,
    query: { status?: RentalHistoryStatus; from?: string; to?: string; search?: string; page?: number; limit?: number } = {}
  ) {
    const courtId = staffCourt(actor);
    const page = pageOf(query.page, query.limit);
    const range = historyRange(query.from, query.to, vietnamNow().date);
    const status = query.status ?? "OUT";
    const { items, total, summary } = await inventoryRepository.rentalsPage(courtId, {
      status,
      from: range.from,
      to: range.to,
      search: likePattern(query.search),
      limit: page.limit,
      offset: page.offset
    });
    return { status, range, summary, items, pagination: paginationOf(total, page) };
  },

  async listSuppliers(partnerId: string) {
    return inventoryRepository.listSuppliers(partnerId);
  },

  async createSupplier(partnerId: string, data: CreateSupplierInput) {
    return inventoryRepository.createSupplier(partnerId, data);
  },

  // A receptionist can only propose a draft for their own court; approving and ordering is the partner's call.
  async createPurchaseOrder(actor: InventoryActor, data: CreatePurchaseOrderInput) {
    assertPartner(actor);
    return inventoryRepository.createPurchaseOrder(actor.partnerId, actor.userId, data);
  },

  /** Gathers every reorder suggestion of one court into a single draft for a person to review and order. */
  async createDraftFromSuggestions(actor: InventoryActor, courtId?: string) {
    assertPartner(actor);
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
    assertPartner(actor);
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
    assertPartner(actor);
    return inventoryRepository.listPurchaseOrders(actor.partnerId, { ...filter, courtId: actor.courtId ?? filter.courtId });
  }
};
