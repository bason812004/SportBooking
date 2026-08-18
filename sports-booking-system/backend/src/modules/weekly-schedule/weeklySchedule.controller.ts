import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { weeklyScheduleService } from "./weeklySchedule.service.js";

export const weeklyScheduleController = {
  show: asyncHandler(async (req, res) => {
    try {
      const { courtId } = req.params;
      const weekStart = typeof req.query.weekStart === "string" ? req.query.weekStart : undefined;
      const surfaceId = typeof req.query.surfaceId === "string" ? req.query.surfaceId : typeof req.query.courtSurfaceId === "string" ? req.query.courtSurfaceId : undefined;
      const result = await weeklyScheduleService.build(courtId, weekStart, surfaceId);
      sendSuccess(res, result);
    } catch (err: any) {
      console.error("[SCHEDULE_500_ERROR]", req.params, req.query, err?.stack || err);
      res.status(500).json({ success: false, message: err?.message || "Internal error", stack: err?.stack });
    }
  })
};
