import { env } from "../../config/env.js";
import { AppError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { bookingService } from "../bookings/booking.service.js";
import { chatbotRepository } from "./chatbot.repository.js";
import { buildSystemPrompt } from "./chatbot.knowledge.js";
import { executeTool, toolsForAuthState } from "./chatbot.tools.js";
import { getLlmProvider } from "./providers/llmProviderFactory.js";
import type { ChatHistoryTurn, ChatUser, PendingBookingSummary, SendMessageInput, SendMessageResult } from "./chatbot.types.js";

export const chatbotService = {
  async sendMessage(user: ChatUser, input: SendMessageInput): Promise<SendMessageResult> {
    const provider = getLlmProvider();
    const isAuthenticated = Boolean(user);

    let conversationId: string | null = null;
    let history: ChatHistoryTurn[] = [];

    if (isAuthenticated) {
      if (input.conversationId) {
        const conversation = await chatbotRepository.findConversationForUser(user!.id, input.conversationId);
        if (!conversation) throw new NotFoundError("Khong tim thay cuoc hoi thoai");
        conversationId = conversation.id;
        history = await chatbotRepository.getConversationMessages(conversationId);
      } else {
        const conversation = await chatbotRepository.createConversation(user!.id, input.message.slice(0, 150));
        conversationId = conversation.id;
      }
    } else {
      history = input.history ?? [];
    }

    const tools = toolsForAuthState(isAuthenticated);
    const system = buildSystemPrompt({ isAuthenticated, currentDate: new Date() });
    const state = provider.createConversation(system, history, input.message);

    if (isAuthenticated && conversationId) {
      await chatbotRepository.appendMessage(conversationId, "user", input.message);
    }

    let pendingBooking: PendingBookingSummary | null = null;
    let loops = 0;

    while (loops < env.CHATBOT_MAX_TOOL_LOOPS) {
      loops += 1;

      const turn = await provider.nextTurn(state, tools);

      if (turn.type === "text") {
        if (isAuthenticated && conversationId) {
          await chatbotRepository.appendMessage(conversationId, "assistant", turn.text);
        }
        return { conversationId, reply: turn.text, pendingBooking };
      }

      const results = [];
      for (const call of turn.calls) {
        const tool = tools.find((t) => t.name === call.name);
        if (!tool) {
          results.push({ callId: call.id, toolName: call.name, isError: true, content: "Cong cu khong kha dung." });
          continue;
        }

        const { isError, result } = await executeTool(tool, call.input, { userId: user?.id });

        if (tool.name === "propose_booking" && !isError) {
          pendingBooking = (result as { summary: PendingBookingSummary }).summary;
        }

        results.push({ callId: call.id, toolName: call.name, isError, content: JSON.stringify(result) });
      }

      state.appendToolResults(results);
    }

    const fallback = "Xin loi, yeu cau nay hoi phuc tap. Ban co the noi ro hon duoc khong?";
    if (isAuthenticated && conversationId) {
      await chatbotRepository.appendMessage(conversationId, "assistant", fallback);
    }
    return { conversationId, reply: fallback, pendingBooking };
  },

  async listConversations(userId: string) {
    return chatbotRepository.listConversations(userId);
  },

  async getConversation(userId: string, conversationId: string) {
    const conversation = await chatbotRepository.findConversationForUser(userId, conversationId);
    if (!conversation) throw new NotFoundError("Khong tim thay cuoc hoi thoai");
    const messages = await chatbotRepository.getConversationMessages(conversationId);
    return { conversation, messages };
  },

  async confirmBooking(userId: string, pendingBookingId: string) {
    const pending = await chatbotRepository.findPendingBookingForUser(userId, pendingBookingId);
    if (!pending) throw new NotFoundError("Khong tim thay de xuat dat san");
    if (pending.status !== "PENDING") throw new ValidationError("De xuat dat san nay khong con hieu luc");
    if (pending.expiresAt.getTime() < Date.now()) {
      await chatbotRepository.markPendingBookingStatus(pending.id, "EXPIRED");
      throw new ValidationError("De xuat dat san da het han, vui long yeu cau lai");
    }

    const quotePayload = pending.quotePayload as any;

    // Re-quote to guard against price/availability drift between propose and confirm.
    await bookingService.quote(userId, quotePayload);

    try {
      const result = await bookingService.checkout(userId, quotePayload);
      await chatbotRepository.markPendingBookingStatus(pending.id, "CONFIRMED");
      return result;
    } catch (error) {
      if (error instanceof AppError) {
        await chatbotRepository.markPendingBookingStatus(pending.id, "CANCELLED");
      }
      throw error;
    }
  }
};
