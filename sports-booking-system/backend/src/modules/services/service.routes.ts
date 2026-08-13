import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { serviceController } from "./service.controller.js";

export const serviceRoutes = Router();

// Public / User routes
serviceRoutes.get("/categories", asyncHandler(serviceController.listCategories));
serviceRoutes.get("/courts/:courtId", asyncHandler(serviceController.listCourtServices));
serviceRoutes.get("/detail/:id", asyncHandler(serviceController.getServiceById));

// Partner / Recipient routes
serviceRoutes.get("/partner", authMiddleware, requireRole(UserRole.PARTNER, UserRole.RECIPIENT), asyncHandler(serviceController.listPartnerServices));
serviceRoutes.post("/partner", authMiddleware, requireRole(UserRole.PARTNER), asyncHandler(serviceController.createService));
serviceRoutes.patch("/partner/:id", authMiddleware, requireRole(UserRole.PARTNER), asyncHandler(serviceController.updateService));
serviceRoutes.delete("/partner/:id", authMiddleware, requireRole(UserRole.PARTNER), asyncHandler(serviceController.deleteService));
serviceRoutes.post("/categories", authMiddleware, requireRole(UserRole.PARTNER, UserRole.ADMIN), asyncHandler(serviceController.createCategory));
