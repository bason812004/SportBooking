export type ChatRole = "user" | "assistant";

export type ChatHistoryTurn = {
  role: ChatRole;
  content: string;
};

export type SendMessageInput = {
  conversationId?: string;
  message: string;
  history?: ChatHistoryTurn[];
};

export type ChatUser = { id: string; role: string } | undefined;

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

export type SendMessageResult = {
  conversationId: string | null;
  reply: string;
  pendingBooking: PendingBookingSummary | null;
};
