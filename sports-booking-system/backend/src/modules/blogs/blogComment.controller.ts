import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { blogCommentService } from "./blogComment.service.js";

export const blogCommentController = {
  list: asyncHandler(async (req, res) => sendSuccess(res, await blogCommentService.list(req.params.slug))),
  create: asyncHandler(async (req, res) => sendSuccess(res, await blogCommentService.create(req.params.slug, req.user!.id, req.body.content), 201))
};
