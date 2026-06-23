import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { authService } from "./auth.service.js";

export const authController = {
  requestRegistrationCode: asyncHandler(async (req, res) =>
    sendSuccess(res, await authService.requestRegistrationCode(req.body), 200, "Mã xác thực đã được gửi đến email của bạn.")
  ),
  verifyRegistrationCode: asyncHandler(async (req, res) =>
    sendSuccess(res, await authService.verifyRegistrationCode(req.body), 201, "Xác thực email thành công. Tài khoản đã được tạo.")
  ),
  resendRegistrationCode: asyncHandler(async (req, res) =>
    sendSuccess(res, await authService.resendRegistrationCode(req.body.email), 200, "Mã xác thực mới đã được gửi đến email của bạn.")
  ),
  requestPartnerRegistrationCode: asyncHandler(async (req, res) =>
    sendSuccess(res, await authService.requestPartnerRegistrationCode(req.body), 200, "Mã xác thực đã được gửi đến email của bạn.")
  ),
  login: asyncHandler(async (req, res) => sendSuccess(res, await authService.login(req.body))),
  google: asyncHandler(async (req, res) => sendSuccess(res, await authService.google(req.body))),
  refreshToken: asyncHandler(async (req, res) => sendSuccess(res, await authService.refresh(req.body.refreshToken))),
  logout: asyncHandler(async (req, res) => sendSuccess(res, await authService.logout(req.body?.refreshToken))),
  me: asyncHandler(async (req, res) => sendSuccess(res, await authService.me(req.user!.id))),
  changePassword: asyncHandler(async (req, res) =>
    sendSuccess(res, await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword))
  )
};
