import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { walletController } from "./wallet.controller.js";

const partnerRoutes = Router();
const adminRoutes = Router();

partnerRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerRoutes.get("/me", walletController.getMyWallet);

adminRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminRoutes.get("/partner-wallets", walletController.listForAdmin);
adminRoutes.get("/partner-wallets/summary", walletController.summaryForAdminRoute);
adminRoutes.get("/partner-wallets/:partnerId", walletController.getForAdmin);

export { partnerRoutes as partnerWalletRoutes, adminRoutes as adminWalletRoutes };
