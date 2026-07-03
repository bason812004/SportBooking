import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { blogService } from "./blog.service.js";

export const blogController = {
  list: asyncHandler(async (_req, res) => sendSuccess(res, await blogService.list())),
  listMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.listMine(req.user!.id))),
  detailMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.detailMine(req.params.id, req.user!.id))),
  createMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.createMine(req.user!.id, req.body), 201)),
  updateMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.updateMine(req.params.id, req.user!.id, req.body))),
  deleteMine: asyncHandler(async (req, res) => sendSuccess(res, await blogService.deleteMine(req.params.id, req.user!.id))),
  detail: asyncHandler(async (req, res) => sendSuccess(res, await blogService.detail(req.params.slug)))
};
