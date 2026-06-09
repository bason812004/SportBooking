import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { voucherService } from "./voucher.service.js";
export const voucherController = {
    list: asyncHandler(async (_req, res) => sendSuccess(res, await voucherService.list())),
    detail: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.detail(req.params.id)))
};
