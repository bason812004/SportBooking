import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { reportService } from "./report.service.js";

export const reportController = {
  create: asyncHandler(async (req, res) => sendSuccess(res, await reportService.create(req.user!.id, req.body), 201)),
  thread: asyncHandler(async (req, res) => sendSuccess(res, await reportService.thread(req.user!.id, req.params.id))),
  reply: asyncHandler(async (req, res) => sendSuccess(res, await reportService.reply(req.user!.id, req.params.id, req.body.content), 201))
};
