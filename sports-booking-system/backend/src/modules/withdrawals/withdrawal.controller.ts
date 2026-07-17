import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { withdrawalService } from "./withdrawal.service.js";

export const withdrawalController = {
  create: asyncHandler(async (req, res) => sendSuccess(res, await withdrawalService.create(req.user!.id, req.body), 201)),
  listMine: asyncHandler(async (req, res) => sendSuccess(res, await withdrawalService.listMine(req.user!.id, req.query))),
  adminList: asyncHandler(async (req, res) => sendSuccess(res, await withdrawalService.adminList(req.query))),
  adminSummary: asyncHandler(async (_req, res) => sendSuccess(res, await withdrawalService.adminSummary())),
  approve: asyncHandler(async (req, res) => sendSuccess(res, await withdrawalService.approve(req.user!.id, req.params.id))),
  reject: asyncHandler(async (req, res) => sendSuccess(res, await withdrawalService.reject(req.user!.id, req.params.id, req.body?.note))),
  markPaid: asyncHandler(async (req, res) => sendSuccess(res, await withdrawalService.markPaid(req.user!.id, req.params.id, req.body?.note)))
};
