import { api } from "../../../lib/axios";
import type { ApiResponse } from "../../../types/api";

export type ChatMessageRole = "user" | "assistant";

export type ChatHistoryTurn = {
  role: ChatMessageRole;
  content: string;
};

export type PendingBookingSummary = {
  pendingBookingId: string;
  courtId: string;
  courtName: string;
  bookingDate: string;
  slots: Array<{ startTime: string; endTime: string }>;
  totalAmount: number;
  paymentType: "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT";
  paymentAmount: number;
  expiresAt: string;
};

export type SendMessagePayload = {
  conversationId?: string;
  message: string;
  history?: ChatHistoryTurn[];
};

export type SendMessageResult = {
  conversationId: string | null;
  reply: string;
  pendingBooking: PendingBookingSummary | null;
};

export type ConfirmBookingResult = {
  bookingId: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentType: "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT";
  totalAmount: number;
  paymentAmount: number;
  remainingAmount: number;
  qrCodeUrl?: string | null;
};

export const chatbotApi = {
  async sendMessage(payload: SendMessagePayload) {
    const { data } = await api.post<ApiResponse<SendMessageResult>>("/chatbot/messages", payload);
    return data.data;
  },
  async confirmBooking(pendingBookingId: string) {
    const { data } = await api.post<ApiResponse<ConfirmBookingResult>>("/chatbot/bookings/confirm", { pendingBookingId });
    return data.data;
  },
  async listConversations() {
    const { data } = await api.get<ApiResponse<Array<{ id: string; title: string | null; updatedAt: string }>>>(
      "/chatbot/conversations"
    );
    return data.data;
  }
};
