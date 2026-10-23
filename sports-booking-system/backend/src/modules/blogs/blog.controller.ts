import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { blogService } from "./blog.service.js";

// Users have no draft step in their editor: saving sends the post for review.
const userSave = { submit: true };

export const blogController = {
  // req.query has been parsed by blogListQuerySchema (page/limit are numbers, sort is checked).
  list: asyncHandler(async (req, res) => sendSuccess(res, await blogService.list(req.query as Parameters<typeof blogService.list>[0]))),
  listMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.listMine(req.user!.id))),
  detailMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.detailMine(req.params.id, req.user!.id))),
  createMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.createMine(req.user!.id, req.body, userSave), 201)),
  updateMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.updateMine(req.params.id, req.user!.id, req.body, userSave))),
  submitMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.submitMine(req.params.id, req.user!.id))),
  updateMineComments: asyncHandler(async (req, res) => sendSuccess(res, await blogService.updateMineComments(req.params.id, req.user!.id, req.body.allowComments))),
  deleteMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.deleteMine(req.params.id, req.user!.id))),
  detail: asyncHandler(async (req, res) => sendSuccess(res, await blogService.detail(req.params.slug)))
};
