import { prisma } from "../../config/db.js";
import type { ChatHistoryTurn, ChatRole } from "./chatbot.types.js";

const MAX_HISTORY_MESSAGES = 40;

export const chatbotRepository = {
  async createConversation(userId: string, title?: string) {
    return prisma.chatConversation.create({ data: { userId, title } });
  },

  async findConversationForUser(userId: string, conversationId: string) {
    return prisma.chatConversation.findFirst({ where: { id: conversationId, userId } });
  },

  async listConversations(userId: string) {
    return prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
  },

  async getConversationMessages(conversationId: string): Promise<ChatHistoryTurn[]> {
    const rows = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: MAX_HISTORY_MESSAGES
    });
    return rows
      .filter((row) => row.role === "user" || row.role === "assistant")
      .map((row) => ({ role: row.role as ChatRole, content: row.content }));
  },

  async appendMessage(conversationId: string, role: ChatRole, content: string, toolCallsJson?: unknown) {
    await prisma.$transaction([
      prisma.chatMessage.create({
        data: { conversationId, role, content, toolCallsJson: toolCallsJson as never }
      }),
      prisma.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
    ]);
  },

  async createPendingBooking(params: {
    userId: string;
    quotePayload: unknown;
    quoteSummary: unknown;
    expiresAt: Date;
  }) {
    return prisma.pendingBooking.create({
      data: {
        userId: params.userId,
        quotePayload: params.quotePayload as never,
        quoteSummary: params.quoteSummary as never,
        status: "PENDING",
        expiresAt: params.expiresAt
      }
    });
  },

  async findPendingBookingForUser(userId: string, pendingBookingId: string) {
    return prisma.pendingBooking.findFirst({ where: { id: pendingBookingId, userId } });
  },

  async markPendingBookingStatus(id: string, status: "CONFIRMED" | "EXPIRED" | "CANCELLED") {
    await prisma.pendingBooking.update({ where: { id }, data: { status } });
  }
};
