import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { userService } from "./user.service.js";
export const userController = {
    me: asyncHandler(async (req, res) => sendSuccess(res, await userService.me(req.user.id))),
    updateMe: asyncHandler(async (req, res) => sendSuccess(res, await userService.updateMe(req.user.id, req.body))),
    bookings: asyncHandler(async (req, res) => sendSuccess(res, await userService.bookings(req.user.id, req.query)))
};
