import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { walletController } from "./wallet.controller.js";

export const partnerWalletRoutes = Router();
partnerWalletRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerWalletRoutes.get("/me", walletController.myWallet);

export const adminWalletRoutes = Router();
adminWalletRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminWalletRoutes.get("/partner-wallets", walletController.adminList);
adminWalletRoutes.get("/partner-wallets/summary", walletController.adminSummary);
adminWalletRoutes.get("/partner-wallets/:partnerId", walletController.adminDetail);
