import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { bookingReminderService } from "./bookingReminder.service.js";

export const bookingReminderController = {
  adminList: asyncHandler(async (req, res) => sendSuccess(res, await bookingReminderService.listSent(req.query)))
};
