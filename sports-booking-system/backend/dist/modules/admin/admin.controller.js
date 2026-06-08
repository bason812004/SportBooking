import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { adminService } from "./admin.service.js";
export const adminController = {
    dashboard: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.dashboard())),
    users: asyncHandler(async (req, res) => sendSuccess(res, await adminService.users(req.query))),
    lockUser: asyncHandler(async (req, res) => sendSuccess(res, await adminService.lockUser(req.params.id))),
    unlockUser: asyncHandler(async (req, res) => sendSuccess(res, await adminService.unlockUser(req.params.id))),
    partners: asyncHandler(async (req, res) => sendSuccess(res, await adminService.partners(req.query))),
    approvePartner: asyncHandler(async (req, res) => sendSuccess(res, await adminService.approvePartner(req.params.id))),
    rejectPartner: asyncHandler(async (req, res) => sendSuccess(res, await adminService.rejectPartner(req.params.id))),
    pendingCourts: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.pendingCourts())),
    approveCourt: asyncHandler(async (req, res) => sendSuccess(res, await adminService.approveCourt(req.params.id))),
    rejectCourt: asyncHandler(async (req, res) => sendSuccess(res, await adminService.rejectCourt(req.params.id, req.body.reason))),
    categories: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.categories())),
    createCategory: asyncHandler(async (req, res) => sendSuccess(res, await adminService.createCategory(req.body), 201)),
    updateCategory: asyncHandler(async (req, res) => sendSuccess(res, await adminService.updateCategory(req.params.id, req.body))),
    deleteCategory: asyncHandler(async (req, res) => sendSuccess(res, await adminService.deleteCategory(req.params.id))),
    reviews: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.reviews())),
    hideReview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.hideReview(req.params.id))),
    showReview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.showReview(req.params.id))),
    deleteReview: asyncHandler(async (req, res) => sendSuccess(res, await adminService.deleteReview(req.params.id))),
    reports: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.reports())),
    resolveReport: asyncHandler(async (req, res) => sendSuccess(res, await adminService.resolveReport(req.params.id))),
    rejectReport: asyncHandler(async (req, res) => sendSuccess(res, await adminService.rejectReport(req.params.id))),
    statistics: asyncHandler(async (_req, res) => sendSuccess(res, await adminService.statistics()))
};
