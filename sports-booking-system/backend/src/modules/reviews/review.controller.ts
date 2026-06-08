import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { reviewService } from "./review.service.js";

export const reviewController = {
  listByCourt: asyncHandler(async (req, res) => sendSuccess(res, await reviewService.listByCourt(req.params.id))),
  create: asyncHandler(async (req, res) => sendSuccess(res, await reviewService.create(req.user!.id, req.body), 201))
};
