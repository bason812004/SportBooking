import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { blogService } from "./blog.service.js";
export const blogController = {
    list: asyncHandler(async (_req, res) => sendSuccess(res, await blogService.list())),
    detail: asyncHandler(async (req, res) => sendSuccess(res, await blogService.detail(req.params.slug)))
};
