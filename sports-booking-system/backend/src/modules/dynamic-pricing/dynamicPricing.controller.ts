import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { dynamicPricingService } from "./dynamicPricing.service.js";

export const dynamicPricingController = {
  calculate: asyncHandler(async (req, res) =>
    sendSuccess(
      res,
      await dynamicPricingService.calculate(req.params.courtId, {
        date: String(req.query.date),
        startTime: String(req.query.startTime),
        endTime: String(req.query.endTime)
      })
    )
  ),
  listRules: asyncHandler(async (req, res) => sendSuccess(res, await dynamicPricingService.listRules(req.user!.id))),
  getRule: asyncHandler(async (req, res) => sendSuccess(res, await dynamicPricingService.getRule(req.user!.id, req.params.id))),
  createRule: asyncHandler(async (req, res) => sendSuccess(res, await dynamicPricingService.createRule(req.user!.id, req.body), 201)),
  updateRule: asyncHandler(async (req, res) => sendSuccess(res, await dynamicPricingService.updateRule(req.user!.id, req.params.id, req.body))),
  deleteRule: asyncHandler(async (req, res) => sendSuccess(res, await dynamicPricingService.deleteRule(req.user!.id, req.params.id))),
  activate: asyncHandler(async (req, res) => sendSuccess(res, await dynamicPricingService.setStatus(req.user!.id, req.params.id, "ACTIVE"))),
  deactivate: asyncHandler(async (req, res) => sendSuccess(res, await dynamicPricingService.setStatus(req.user!.id, req.params.id, "INACTIVE")))
};
