import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { weeklyScheduleService } from "./weeklySchedule.service.js";

export const weeklyScheduleController = {
  show: asyncHandler(async (req, res) => {
    const { courtId } = req.params;
    const weekStart = typeof req.query.weekStart === "string" ? req.query.weekStart : undefined;
    const result = await weeklyScheduleService.build(courtId, weekStart);
    sendSuccess(res, result);
  })
};
