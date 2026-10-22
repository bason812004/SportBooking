import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { analyticsService } from "./analytics.service.js";
export const analyticsController = {
    partnerOverview: asyncHandler(async (req, res) => sendSuccess(res, await analyticsService.partnerOverview(req.user.id))),
    partnerRevenue: asyncHandler(async (req, res) => sendSuccess(res, await analyticsService.partnerRevenue(req.user.id))),
    partnerOccupancy: asyncHandler(async (req, res) => sendSuccess(res, await analyticsService.partnerOccupancy(req.user.id))),
    partnerVouchers: asyncHandler(async (req, res) => sendSuccess(res, await analyticsService.partnerVouchers(req.user.id))),
    partnerTournaments: asyncHandler(async (req, res) => sendSuccess(res, await analyticsService.partnerTournaments(req.user.id))),
    partnerPeakHours: asyncHandler(async (req, res) => sendSuccess(res, await analyticsService.partnerPeakHours(req.user.id))),
    adminOverview: asyncHandler(async (_req, res) => sendSuccess(res, await analyticsService.adminOverview())),
    adminRevenue: asyncHandler(async (_req, res) => sendSuccess(res, await analyticsService.adminOverview())),
    adminBookings: asyncHandler(async (_req, res) => sendSuccess(res, await analyticsService.adminOverview())),
    adminVouchers: asyncHandler(async (_req, res) => sendSuccess(res, { total: (await analyticsService.adminOverview()).vouchers })),
    adminTournaments: asyncHandler(async (_req, res) => sendSuccess(res, { total: (await analyticsService.adminOverview()).tournaments })),
    adminDemandPrediction: asyncHandler(async (_req, res) => sendSuccess(res, await analyticsService.adminPredictionStatus()))
};
