import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { tournamentService } from "./tournament.service.js";

export const tournamentController = {
  list: asyncHandler(async (_req, res) => sendSuccess(res, await tournamentService.list())),
  detail: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.detail(req.params.slug))),
  register: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.register(req.user!.id, req.params.id, req.body), 201)),
  partnerList: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.listPartner(req.user!.id))),
  partnerCreate: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.createPartner(req.user!.id, req.body), 201)),
  partnerDetail: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.getPartner(req.user!.id, req.params.id))),
  partnerUpdate: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.updatePartner(req.user!.id, req.params.id, req.body))),
  partnerDelete: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.deletePartner(req.user!.id, req.params.id))),
  partnerRegistrations: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.registrations(req.user!.id, req.params.id))),
  approveRegistration: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.updateRegistration(req.user!.id, req.params.id, "APPROVED"))),
  rejectRegistration: asyncHandler(async (req, res) => sendSuccess(res, await tournamentService.updateRegistration(req.user!.id, req.params.id, "REJECTED")))
};
