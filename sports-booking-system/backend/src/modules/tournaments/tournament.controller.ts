import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { tournamentService } from "./tournament.service.js";

export const tournamentController = {
  list: asyncHandler(async (_req, res) => sendSuccess(res, await tournamentService.list())),
  detail: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.detail(req.params.slug)))
};
