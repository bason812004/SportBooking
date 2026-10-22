import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { notificationService } from "./notification.service.js";

export const notificationController = {
  listMine: asyncHandler(async (req, res) => sendSuccess(res, await notificationService.list(req.user!.id, req.query))),
  markRead: asyncHandler(async (req, res) => sendSuccess(res, await notificationService.markRead(req.user!.id, req.params.id))),
  markAllRead: asyncHandler(async (req, res) => sendSuccess(res, await notificationService.markAllRead(req.user!.id)))
};
