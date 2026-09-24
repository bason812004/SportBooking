import type { Request, Response } from "express";
import { prisma } from "../../config/db.js";
import { ForbiddenError } from "../../shared/errors/AppError.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { inventoryService } from "./inventory.service.js";

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

  const firstPartner = await prisma.partnerProfile.findFirst({ select: { id: true } });
  return { partnerId: firstPartner?.id || "p0001", managedCourtId: null };
}

async function getPartnerId(userId: string): Promise<string> {
  const { partnerId } = await getPartnerScope(userId);
  return partnerId;
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
    const partnerId = await getPartnerId(req.user!.id);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const data = await inventoryService.getLowStockAlerts(partnerId, limit);
    return sendSuccess(res, data);
  },

  async getReorderSuggestions(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const data = await inventoryService.getReorderSuggestions(partnerId);
    return sendSuccess(res, data);
  },

  async adjustStock(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const result = await inventoryService.adjustStock(partnerId, req.body);
    return sendSuccess(res, result, 200, "Cập nhật tồn kho thành công");
  },

  async getTransactions(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const txs = await inventoryService.getTransactions(partnerId, limit);
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
    const partnerId = await getPartnerId(req.user!.id);
    const po = await inventoryService.createPurchaseOrder(partnerId, req.body);
    return sendSuccess(res, po, 201, "Tạo đơn nhập hàng thành công");
  },

  async listPurchaseOrders(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const orders = await inventoryService.listPurchaseOrders(partnerId);
    return sendSuccess(res, orders);
  }
};
