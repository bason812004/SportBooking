import { Router } from "express";
import { voucherController } from "./voucher.controller.js";
export const voucherRoutes = Router();
voucherRoutes.get("/", voucherController.list);
voucherRoutes.get("/:id", voucherController.detail);
