import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { settlementService } from "./settlement.service.js";

export const settlementController = {
  listMine: asyncHandler(async (req, res) => sendSuccess(res, await settlementService.listMine(req.user!.id, req.query))),
  summaryMine: asyncHandler(async (req, res) => sendSuccess(res, await settlementService.summaryMine(req.user!.id, req.query))),
  detailMine: asyncHandler(async (req, res) => sendSuccess(res, await settlementService.detailMine(req.user!.id, req.params.id))),
  adminList: asyncHandler(async (req, res) => sendSuccess(res, await settlementService.adminList(req.query))),
  adminSummary: asyncHandler(async (req, res) => sendSuccess(res, await settlementService.adminSummary(req.query))),
  adminSettle: asyncHandler(async (req, res) => sendSuccess(res, await settlementService.adminSettle(req.user!.id, req.params.id))),
  adminCancel: asyncHandler(async (req, res) => sendSuccess(res, await settlementService.adminCancel(req.user!.id, req.params.id)))
};
