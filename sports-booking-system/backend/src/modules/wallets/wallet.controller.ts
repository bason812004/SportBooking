import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { walletService } from "./wallet.service.js";

export const walletController = {
  async getMyWallet(req: any, res: any) {
    const wallet = await walletService.getForPartner(req.user!.partnerId);
    return sendSuccess(res, wallet);
  },

  async listForAdmin(req: any, res: any) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await walletService.listForAdmin(page, limit);
    return sendSuccess(res, result);
  },

  async getForAdmin(req: any, res: any) {
    const wallet = await walletService.getForAdmin(req.params.partnerId);
    return sendSuccess(res, wallet);
  },

  async summaryForAdminRoute(_req: any, res: any) {
    const result = await walletService.summaryForAdmin();
    return sendSuccess(res, result);
  }
};
