import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatbotApi, type ChatHistoryTurn, type PendingBookingSummary } from "../api/chatbot";
import { queryKeys } from "../api/queryKeys";

export type ChatDisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function useChatbot() {
  const [messages, setMessages] = useState<ChatDisplayMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingBooking, setPendingBooking] = useState<PendingBookingSummary | null>(null);

  const mutation = useMutation({
    mutationFn: ({ message, history }: { message: string; history: ChatHistoryTurn[] }) =>
      chatbotApi.sendMessage({ conversationId: conversationId ?? undefined, message, history }),
    onSuccess: (result) => {
      if (result.conversationId) setConversationId(result.conversationId);
      setPendingBooking(result.pendingBooking);
      setMessages((previous) => [...previous, { id: `a-${Date.now()}`, role: "assistant", content: result.reply }]);
    }
  });

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || mutation.isPending) return;

      const history = messages.slice(-20).map((message) => ({ role: message.role, content: message.content }));
      setMessages((previous) => [...previous, { id: `u-${Date.now()}`, role: "user", content: trimmed }]);
      mutation.mutate({ message: trimmed, history });
    },
    [messages, mutation]
  );

  const clearPendingBooking = useCallback(() => setPendingBooking(null), []);

  return {
    messages,
    sendMessage,
    isSending: mutation.isPending,
    error: mutation.error as Error | null,
    pendingBooking,
    clearPendingBooking
  };
}

export function useConfirmPendingBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pendingBookingId: string) => chatbotApi.confirmBooking(pendingBookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    }
  });
}
