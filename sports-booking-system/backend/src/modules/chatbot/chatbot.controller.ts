import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { chatbotService } from "./chatbot.service.js";

export const chatbotController = {
  sendMessage: asyncHandler(async (req, res) =>
    sendSuccess(res, await chatbotService.sendMessage(req.user, req.body))
  ),
  listConversations: asyncHandler(async (req, res) =>
    sendSuccess(res, await chatbotService.listConversations(req.user!.id))
  ),
  getConversation: asyncHandler(async (req, res) =>
    sendSuccess(res, await chatbotService.getConversation(req.user!.id, req.params.id))
  ),
  confirmBooking: asyncHandler(async (req, res) =>
    sendSuccess(res, await chatbotService.confirmBooking(req.user!.id, req.body.pendingBookingId), 201)
  )
};
