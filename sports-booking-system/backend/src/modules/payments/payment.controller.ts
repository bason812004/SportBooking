import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { paymentService } from "./payment.service.js";

export const paymentController = {
  detail: asyncHandler(async (req, res) => sendSuccess(res, await paymentService.detail(req.user!.id, req.params.paymentId))),
  status: asyncHandler(async (req, res) => sendSuccess(res, await paymentService.status(req.user!.id, req.params.paymentId))),
  webhook: asyncHandler(async (req, res) => sendSuccess(res, await paymentService.webhook(req.params.provider, req.body, req.headers)))
};
