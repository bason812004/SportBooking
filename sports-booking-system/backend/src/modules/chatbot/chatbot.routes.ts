import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware, optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { chatbotController } from "./chatbot.controller.js";
import { confirmBookingSchema, getConversationSchema, sendMessageSchema } from "./chatbot.validation.js";

export const chatbotRoutes = Router();

chatbotRoutes.post("/messages", optionalAuthMiddleware, validate(sendMessageSchema), chatbotController.sendMessage);

chatbotRoutes.get("/conversations", authMiddleware, requireRole(UserRole.USER), chatbotController.listConversations);
chatbotRoutes.get(
  "/conversations/:id",
  authMiddleware,
  requireRole(UserRole.USER),
  validate(getConversationSchema),
  chatbotController.getConversation
);
chatbotRoutes.post(
  "/bookings/confirm",
  authMiddleware,
  requireRole(UserRole.USER),
  validate(confirmBookingSchema),
  chatbotController.confirmBooking
);
