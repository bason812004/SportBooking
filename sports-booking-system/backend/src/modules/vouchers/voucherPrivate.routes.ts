import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { voucherController } from "./voucher.controller.js";
import { applyVoucherSchema, voucherIdParamsSchema, voucherUpdateSchema, voucherWriteSchema } from "./voucher.validation.js";

export const userVoucherRoutes = Router();
userVoucherRoutes.get("/me/vouchers", authMiddleware, requireRole(UserRole.USER), voucherController.myVouchers);

export const bookingVoucherRoutes = Router();
bookingVoucherRoutes.post("/apply-voucher", authMiddleware, requireRole(UserRole.USER), validate(applyVoucherSchema), voucherController.apply);

export const partnerVoucherRoutes = Router();
partnerVoucherRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerVoucherRoutes.get("/", voucherController.partnerList);
partnerVoucherRoutes.get("/:id", validate(voucherIdParamsSchema), voucherController.partnerDetail);
partnerVoucherRoutes.post("/", validate(voucherWriteSchema), voucherController.partnerCreate);
partnerVoucherRoutes.put("/:id", validate(voucherUpdateSchema), voucherController.partnerUpdate);
partnerVoucherRoutes.delete("/:id", validate(voucherIdParamsSchema), voucherController.partnerDelete);
partnerVoucherRoutes.put("/:id/activate", validate(voucherIdParamsSchema), voucherController.partnerActivate);
partnerVoucherRoutes.put("/:id/disable", validate(voucherIdParamsSchema), voucherController.partnerDisable);
