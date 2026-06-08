import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { authService } from "./auth.service.js";
export const authController = {
    register: asyncHandler(async (req, res) => sendSuccess(res, await authService.register(req.body), 201)),
    registerPartner: asyncHandler(async (req, res) => sendSuccess(res, await authService.registerPartner(req.body), 201)),
    login: asyncHandler(async (req, res) => sendSuccess(res, await authService.login(req.body))),
    logout: asyncHandler(async (_req, res) => sendSuccess(res, { message: "Dang xuat thanh cong" })),
    me: asyncHandler(async (req, res) => sendSuccess(res, await authService.me(req.user.id))),
    changePassword: asyncHandler(async (req, res) => sendSuccess(res, await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword)))
};
