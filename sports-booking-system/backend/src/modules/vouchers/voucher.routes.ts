import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { voucherController } from "./voucher.controller.js";
import { voucherIdParamsSchema } from "./voucher.validation.js";

export const voucherRoutes = Router();

voucherRoutes.get("/", voucherController.list);
voucherRoutes.get("/me", authMiddleware, requireRole(UserRole.USER), voucherController.myVouchers);
voucherRoutes.post("/validate", authMiddleware, requireRole(UserRole.USER), voucherController.validate);
voucherRoutes.post("/:id/click", validate(voucherIdParamsSchema), voucherController.click);
voucherRoutes.get("/:id", voucherController.detail);
voucherRoutes.post("/:id/claim", authMiddleware, requireRole(UserRole.USER), validate(voucherIdParamsSchema), voucherController.claim);
