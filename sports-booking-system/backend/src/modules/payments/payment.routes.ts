import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { paymentController } from "./payment.controller.js";
import { paymentIdSchema, paymentWebhookSchema } from "./payment.validation.js";

export const paymentRoutes = Router();

paymentRoutes.post("/webhook/:provider", validate(paymentWebhookSchema), paymentController.webhook);
paymentRoutes.get("/debug/info", paymentController.debugInfo);
paymentRoutes.get("/debug/checkout", paymentController.debugCheckout);
paymentRoutes.get("/:paymentId", authMiddleware, validate(paymentIdSchema), paymentController.detail);
paymentRoutes.get("/:paymentId/status", authMiddleware, validate(paymentIdSchema), paymentController.status);
