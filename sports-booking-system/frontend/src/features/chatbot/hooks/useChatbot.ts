import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { chatbotApi, type ChatHistoryTurn, type PendingBookingSummary } from "../api/chatbotApi";

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
    mutationFn: (message: string) => {
      const history: ChatHistoryTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
      return chatbotApi.sendMessage({ conversationId: conversationId ?? undefined, message, history });
    },
    onSuccess: (result) => {
      if (result.conversationId) setConversationId(result.conversationId);
      setPendingBooking(result.pendingBooking);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: result.reply }]);
    }
  });

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: trimmed }]);
      mutation.mutate(trimmed);
    },
    [mutation]
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
