import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { reviewService } from "./review.service.js";

export const reviewController = {
  listByCourt: asyncHandler(async (req, res) => sendSuccess(res, await reviewService.listByCourt(req.params.id))),
  eligibility: asyncHandler(async (req, res) =>
    sendSuccess(res, await reviewService.eligibility(req.user!.id, req.user!.role, String(req.query.courtId)))
  ),
  create: asyncHandler(async (req, res) => sendSuccess(res, await reviewService.create(req.user!.id, req.body), 201)),
  update: asyncHandler(async (req, res) => sendSuccess(res, await reviewService.update(req.params.id, req.user!.id, req.body))),
  delete: asyncHandler(async (req, res) => sendSuccess(res, await reviewService.delete(req.params.id, req.user!.id)))
};
