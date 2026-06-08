import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { reportService } from "./report.service.js";

export const reportController = {
  create: asyncHandler(async (req, res) => sendSuccess(res, await reportService.create(req.user!.id, req.body), 201))
};
