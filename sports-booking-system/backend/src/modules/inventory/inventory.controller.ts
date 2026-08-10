import type { Request, Response } from "express";
import { prisma } from "../../config/db.js";
import { ForbiddenError } from "../../shared/errors/AppError.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { inventoryService } from "./inventory.service.js";

async function getPartnerId(userId: string): Promise<string> {
  const partner = await prisma.partnerProfile.findUnique({
    where: { userId },
    select: { id: true }
  });
  if (partner) return partner.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { partnerId: true, managedCourt: { select: { partnerId: true } } }
  });

  if (user?.partnerId) return user.partnerId;
  if (user?.managedCourt?.partnerId) return user.managedCourt.partnerId;

  throw new ForbiddenError("Tài khoản chưa đăng ký đối tác hoặc thu ngân");
}

export const inventoryController = {
  async getInventorySummary(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const data = await inventoryService.getInventorySummary(partnerId);
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
