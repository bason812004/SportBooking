import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { walletService } from "./wallet.service.js";

export const walletController = {
  myWallet: asyncHandler(async (req, res) => sendSuccess(res, await walletService.myWallet(req.user!.id))),
  adminList: asyncHandler(async (req, res) => sendSuccess(res, await walletService.adminList(req.query as Record<string, string>))),
  adminSummary: asyncHandler(async (_req, res) => sendSuccess(res, await walletService.adminSummary())),
  adminDetail: asyncHandler(async (req, res) => sendSuccess(res, await walletService.adminDetail(req.params.partnerId)))
};
