import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { demandPredictionService } from "./demandPrediction.service.js";
export const demandPredictionController = {
    predict: asyncHandler(async (req, res) => sendSuccess(res, await demandPredictionService.predict(req.params.courtId, {
        date: String(req.query.date),
        startTime: String(req.query.startTime),
        endTime: String(req.query.endTime)
    }))),
    overview: asyncHandler(async (req, res) => sendSuccess(res, await demandPredictionService.overview(req.user.id))),
    courtOverview: asyncHandler(async (req, res) => sendSuccess(res, await demandPredictionService.courtOverview(req.user.id, req.params.courtId))),
    peakHours: asyncHandler(async (req, res) => sendSuccess(res, await demandPredictionService.peakHours(req.user.id)))
};
