import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { ValidationError } from "../../shared/errors/AppError.js";
import { blogCommentService } from "./blogComment.service.js";

export const blogCommentController = {
  list: asyncHandler(async (req, res) => {
    if (!req.params.slug) throw new ValidationError("Slug bài viết không hợp lệ");
    return sendSuccess(res, await blogCommentService.list(req.params.slug));
  }),
  create: asyncHandler(async (req, res) => {
    if (!req.params.slug) throw new ValidationError("Slug bài viết không hợp lệ");
    return sendSuccess(res, await blogCommentService.create(req.params.slug, req.user!.id, req.body.content), 201);
  }),
  update: asyncHandler(async (req, res) => {
    if (!req.params.slug) throw new ValidationError("Slug bài viết không hợp lệ");
    return sendSuccess(res, await blogCommentService.update(req.params.slug, req.params.commentId, req.user!.id, req.user!.role, req.body.content));
  }),
  delete: asyncHandler(async (req, res) => {
    if (!req.params.slug) throw new ValidationError("Slug bài viết không hợp lệ");
    return sendSuccess(res, await blogCommentService.delete(req.params.slug, req.params.commentId, req.user!.id, req.user!.role));
  })
};
