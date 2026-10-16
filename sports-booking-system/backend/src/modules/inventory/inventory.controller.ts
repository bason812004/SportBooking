import type { Request, Response } from "express";
import { prisma } from "../../config/db.js";
import { ForbiddenError } from "../../shared/errors/AppError.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { inventoryService } from "./inventory.service.js";
import type { InventoryActor, PurchaseOrderListFilter } from "./inventory.types.js";

async function getPartnerScope(userId: string): Promise<{ partnerId: string; managedCourtId: string | null }> {
  const partner = await prisma.partnerProfile.findUnique({
    where: { userId },
    select: { id: true }
  });
  if (partner) return { partnerId: partner.id, managedCourtId: null };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { partnerId: true, managedCourtId: true, managedCourt: { select: { partnerId: true } } }
  });

  // A receptionist only ever runs one court, so their scope is pinned to it.
  if (user?.partnerId) return { partnerId: user.partnerId, managedCourtId: user.managedCourtId ?? null };
  if (user?.managedCourt?.partnerId) return { partnerId: user.managedCourt.partnerId, managedCourtId: user.managedCourtId ?? null };

  // Never guess a partner: falling back to "the first one" would read and write someone else's stock.
  throw new ForbiddenError("Tài khoản chưa được liên kết với đối tác");
}

async function getPartnerId(userId: string): Promise<string> {
  const { partnerId } = await getPartnerScope(userId);
  return partnerId;
}

// Court-scoped inventory work needs to know which court a receptionist runs; one with no court
// assigned would otherwise see (and restock) every court of the partner.
async function getActor(req: Request): Promise<InventoryActor> {
  const { partnerId, managedCourtId } = await getPartnerScope(req.user!.id);
  if (req.user!.role === "RECIPIENT") {
    if (!managedCourtId) throw new ForbiddenError("Tài khoản lễ tân chưa được gán cụm sân");
    return { userId: req.user!.id, role: "RECIPIENT", partnerId, courtId: managedCourtId };
  }
  return { userId: req.user!.id, role: "PARTNER", partnerId, courtId: null };
}

/** A receptionist always gets their own court, whatever courtId the client asks for. */
function courtFor(actor: InventoryActor, requested: unknown): string | undefined {
  if (actor.courtId) return actor.courtId;
  return typeof requested === "string" && requested.trim() !== "" ? requested.trim() : undefined;
}

export const inventoryController = {
  async getInventorySummary(req: Request, res: Response) {
    const { partnerId, managedCourtId } = await getPartnerScope(req.user!.id);
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
    const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : undefined;
    const sortOrder = typeof req.query.sortOrder === "string" ? req.query.sortOrder : undefined;
    // A receptionist sees only the court they manage, whatever courtId the client asks for.
    const requestedCourtId = typeof req.query.courtId === "string" && req.query.courtId.trim() !== "" ? req.query.courtId.trim() : undefined;
    const courtId = managedCourtId ?? requestedCourtId;
    const data = await inventoryService.getInventorySummary(partnerId, { page, limit, status, search, categoryId, courtId, sortBy, sortOrder });
    return sendSuccess(res, data);
  },

  async getLowStockAlerts(req: Request, res: Response) {
    const actor = await getActor(req);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const data = await inventoryService.getLowStockAlerts(actor.partnerId, limit, courtFor(actor, req.query.courtId));
    return sendSuccess(res, data);
  },

  async getReorderSuggestions(req: Request, res: Response) {
    const actor = await getActor(req);
    const data = await inventoryService.getReorderSuggestions(actor.partnerId, courtFor(actor, req.query.courtId));
    return sendSuccess(res, data);
  },

  async adjustStock(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const result = await inventoryService.adjustStock(partnerId, req.body);
    return sendSuccess(res, result, 200, "Cập nhật tồn kho thành công");
  },

  async getTransactions(req: Request, res: Response) {
    const actor = await getActor(req);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const txs = await inventoryService.getTransactions(actor.partnerId, limit, courtFor(actor, req.query.courtId));
    return sendSuccess(res, txs);
  },

  async listSuppliers(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const suppliers = await inventoryService.listSuppliers(partnerId);
    return sendSuccess(res, suppliers);
  },

  async createSupplier(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const supplier = await inventoryService.createSupplier(partnerId, req.body);
    return sendSuccess(res, supplier, 201, "Tạo nhà cung cấp thành công");
  },

  async createPurchaseOrder(req: Request, res: Response) {
    const actor = await getActor(req);
    const po = await inventoryService.createPurchaseOrder(actor, req.body);
    const message = actor.role === "RECIPIENT" ? "Đã gửi đề xuất nhập hàng cho đối tác duyệt" : "Tạo đơn nhập hàng thành công";
    return sendSuccess(res, po, 201, message);
  },

  async createDraftFromSuggestions(req: Request, res: Response) {
    const actor = await getActor(req);
    const po = await inventoryService.createDraftFromSuggestions(actor, req.body?.courtId);
    return sendSuccess(res, po, 201, "Đã tạo đơn nháp từ gợi ý nhập hàng");
  },

  async updatePurchaseOrder(req: Request, res: Response) {
    const actor = await getActor(req);
    const po = await inventoryService.updatePurchaseOrder(actor, String(req.params.id), req.body);
    return sendSuccess(res, po, 200, "Đã cập nhật đơn nhập hàng");
  },

  async orderPurchaseOrder(req: Request, res: Response) {
    const actor = await getActor(req);
    const po = await inventoryService.orderPurchaseOrder(actor, String(req.params.id));
    return sendSuccess(res, po, 200, "Đã duyệt và chuyển đơn sang trạng thái đã đặt hàng");
  },

  async receivePurchaseOrder(req: Request, res: Response) {
    const actor = await getActor(req);
    const po = await inventoryService.receivePurchaseOrder(actor, String(req.params.id), req.body);
    return sendSuccess(res, po, 200, "Đã nhận hàng và cộng tồn kho theo số thực nhận");
  },

  async cancelPurchaseOrder(req: Request, res: Response) {
    const actor = await getActor(req);
    const po = await inventoryService.cancelPurchaseOrder(actor, String(req.params.id));
    return sendSuccess(res, po, 200, "Đã hủy đơn nhập hàng");
  },

  async listPurchaseOrders(req: Request, res: Response) {
    const actor = await getActor(req);
    const orders = await inventoryService.listPurchaseOrders(actor, req.query as PurchaseOrderListFilter);
    return sendSuccess(res, orders);
  }
};
