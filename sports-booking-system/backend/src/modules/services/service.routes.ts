import { Router } from "express";
import multer from "multer";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { authMiddleware, optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { serviceController } from "./service.controller.js";
import { createServiceCategorySchema, createServiceSchema, serviceIdParamsSchema, updateServiceSchema } from "./service.validation.js";

export const serviceRoutes = Router();

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public / User routes. A signed-in partner, receptionist or admin gets cost prices and stock; everyone else the
// customer view. Sample catalogs are never seeded from here: `npm run seed:services` does it by hand.
serviceRoutes.get("/categories", asyncHandler(serviceController.listCategories));
serviceRoutes.get("/courts/:courtId", optionalAuthMiddleware, asyncHandler(serviceController.listCourtServices));
serviceRoutes.get("/detail/:id", optionalAuthMiddleware, asyncHandler(serviceController.getServiceById));
serviceRoutes.get("/", optionalAuthMiddleware, asyncHandler(serviceController.listServices));

// Partner / Recipient routes
serviceRoutes.get("/partner", authMiddleware, requireRole(UserRole.PARTNER, UserRole.RECIPIENT), asyncHandler(serviceController.listPartnerServices));
serviceRoutes.post("/partner", authMiddleware, requireRole(UserRole.PARTNER), validate(createServiceSchema), asyncHandler(serviceController.createService));
serviceRoutes.patch("/partner/:id", authMiddleware, requireRole(UserRole.PARTNER), validate(updateServiceSchema), asyncHandler(serviceController.updateService));
serviceRoutes.delete("/partner/:id", authMiddleware, requireRole(UserRole.PARTNER), validate(serviceIdParamsSchema), asyncHandler(serviceController.deleteService));
// When the sale and cost prices were set (read only; the partner and their staff).
serviceRoutes.get(
  "/partner/:id/price-history",
  authMiddleware,
  requireRole(UserRole.PARTNER, UserRole.RECIPIENT),
  validate(serviceIdParamsSchema),
  asyncHandler(serviceController.priceHistory)
);
serviceRoutes.post(
  "/partner/image",
  authMiddleware,
  requireRole(UserRole.PARTNER),
  imageUpload.single("image"),
  asyncHandler(serviceController.uploadServiceImage)
);
// Categories are shared by every partner, so only an admin adds one.
serviceRoutes.post("/categories", authMiddleware, requireRole(UserRole.ADMIN), validate(createServiceCategorySchema), asyncHandler(serviceController.createCategory));

// Catch-all by id stays last: Express matches in registration order, so declaring it earlier makes
// "/partner", "/categories" and friends resolve as an id and 404 on a lookup that was never meant.
serviceRoutes.get("/:id", optionalAuthMiddleware, asyncHandler(serviceController.getServiceById));
