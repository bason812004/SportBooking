import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { payoutController } from "./payout.controller.js";
import { payoutWebhookSchema } from "./payout.validation.js";

export const payoutRoutes = Router();

payoutRoutes.post("/webhook/:provider", validate(payoutWebhookSchema), payoutController.webhook);
