import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { voucherService } from "./voucher.service.js";

export const voucherController = {
  list: asyncHandler(async (_req, res) => sendSuccess(res, await voucherService.list())),
  detail: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.detail(req.params.id))),
  click: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.trackClick(req.params.id))),
  claim: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.claim(req.user!.id, req.params.id), 201)),
  claimAllPlatform: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.claimAllPlatformVouchers(req.user!.id))),
  myVouchers: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.listForUser(req.user!.id))),
  apply: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.apply({ ...req.body, userId: req.user?.id }))),
  validate: asyncHandler(async (req, res) =>
    sendSuccess(res, await voucherService.validate({ ...req.body, userId: req.user?.id }))
  ),
  checkEligibility: asyncHandler(async (req, res) =>
    sendSuccess(res, await voucherService.checkEligibilityForBooking({
      ...req.body,
      userId: req.user?.id,
      lang: req.body.lang ?? (req.headers["accept-language"]?.toString().startsWith("en") ? "en" : "vi")
    }))
  ),
  partnerList: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.listPartner(req.user!.id))),
  partnerCreate: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.createPartner(req.user!.id, req.body), 201)),
  partnerUpdate: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.updatePartner(req.user!.id, req.params.id, req.body))),
  partnerDelete: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.deletePartner(req.user!.id, req.params.id))),
  partnerActivate: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.setPartnerStatus(req.user!.id, req.params.id, "ACTIVE"))),
  partnerDisable: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.setPartnerStatus(req.user!.id, req.params.id, "DISABLED"))),
  adminList: asyncHandler(async (_req, res) => sendSuccess(res, await voucherService.listAdmin())),
  adminDisable: asyncHandler(async (req, res) => sendSuccess(res, await voucherService.disableAdmin(req.params.id)))
};
