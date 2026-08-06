import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { withdrawalService } from "../withdrawals/withdrawal.service.js";

export const payoutController = {
  webhook: asyncHandler(async (req, res) =>
    sendSuccess(res, await withdrawalService.handleProviderWebhook(req.params.provider, req.body, req.headers))
  )
};
