import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { withdrawalService } from "./withdrawal.service.js";

export const withdrawalController = {
  async create(req: any, res: any) {
    const withdrawal = await withdrawalService.create(req.user!.partnerId, req.body);
    return sendSuccess(res, withdrawal, 201);
  },

  async listForPartner(req: any, res: any) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await withdrawalService.listForPartner(req.user!.partnerId, page, limit);
    return sendSuccess(res, result);
  },

  async listForAdmin(req: any, res: any) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await withdrawalService.listAll({
      page,
      limit,
      partnerId: req.query.partnerId,
      status: req.query.status
    });
    return sendSuccess(res, result);
  },

  async approve(req: any, res: any) {
    const withdrawal = await withdrawalService.approve(req.params.id, req.user!.id);
    return sendSuccess(res, withdrawal);
  },

  async reject(req: any, res: any) {
    const withdrawal = await withdrawalService.reject(req.params.id, req.user!.id, req.body.note);
    return sendSuccess(res, withdrawal);
  },

  async markPaid(req: any, res: any) {
    const withdrawal = await withdrawalService.markPaid(req.params.id, req.user!.id);
    return sendSuccess(res, withdrawal);
  },

  async summaryForAdminRoute(_req: any, res: any) {
    const result = await withdrawalService.summaryForAdmin({});
    return sendSuccess(res, result);
  }
};
