import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { courtService } from "./court.service.js";

export const courtController = {
  list: asyncHandler(async (req, res) => sendSuccess(res, await courtService.list(req.query))),
  detail: asyncHandler(async (req, res) => sendSuccess(res, await courtService.detail(req.params.id))),
  availability: asyncHandler(async (req, res) =>
    sendSuccess(res, await courtService.availability(req.params.id, String(req.query.date), req.query.courtSurfaceId as string | undefined))
  )
};
