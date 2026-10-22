import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { notificationController } from "./notification.controller.js";
import { notificationIdSchema } from "./notification.validation.js";

export const notificationRoutes = Router();

notificationRoutes.use(authMiddleware);
notificationRoutes.get("/me/notifications", notificationController.listMine);
notificationRoutes.put("/me/notifications/read-all", notificationController.markAllRead);
notificationRoutes.put("/me/notifications/:id/read", validate(notificationIdSchema), notificationController.markRead);
