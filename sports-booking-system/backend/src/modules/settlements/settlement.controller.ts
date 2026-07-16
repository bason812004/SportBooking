import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { settlementService } from "./settlement.service.js";

export const settlementController = {
  async listForPartner(req: any, res: any) {
    const { id: partnerId } = req.user!;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await settlementService.listForPartner(partnerId, page, limit);
    return sendSuccess(res, result);
  },

  async detailForPartner(req: any, res: any) {
    const { id: partnerId } = req.user!;
    const settlement = await settlementService.getById(req.params.id);
    if (settlement.partnerId !== partnerId) {
      const { ForbiddenError } = await import("../../shared/errors/AppError.js");
      throw new ForbiddenError("Khong co quyen truy cap");
    }
    return sendSuccess(res, settlement);
  },

  async summaryForPartner(req: any, res: any) {
    const { id: partnerId } = req.user!;
    const summary = await settlementService.summaryForAdmin({ partnerId });
    return sendSuccess(res, summary);
  },

  async listForAdmin(req: any, res: any) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await settlementService.listAll({
      page,
      limit,
      partnerId: req.query.partnerId,
      status: req.query.status,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    });
    return sendSuccess(res, result);
  },

  async settleForAdmin(req: any, res: any) {
    const settlement = await settlementService.settle(req.params.id, req.user!.id);
    return sendSuccess(res, settlement);
  },

  async cancelForAdmin(req: any, res: any) {
    const settlement = await settlementService.cancel(req.params.id, req.user!.id, req.body.reason);
    return sendSuccess(res, settlement);
  },

  async summaryForAdminRoute(_req: any, res: any) {
    const result = await settlementService.summaryForAdmin({});
    return sendSuccess(res, result);
  }
};
