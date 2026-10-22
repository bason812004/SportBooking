import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { courtImageService } from "./courtImage.service.js";

export const courtImageController = {
  partnerList: asyncHandler(async (req, res) => sendSuccess(res, await courtImageService.listForPartner(req.user!.id, req.params.id))),
  pending: asyncHandler(async (_req, res) => sendSuccess(res, await courtImageService.listPending())),
  cancel: asyncHandler(async (req, res) => sendSuccess(res, await courtImageService.cancel(req.user!.id, req.params.id))),
  review: asyncHandler(async (req, res) => sendSuccess(res, await courtImageService.review(req.user!.id, req.params.id, req.body.decision, req.body.reason)))
};
