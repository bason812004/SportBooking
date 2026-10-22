import { useEffect, useRef } from "react";
import type { ChatDisplayMessage } from "../hooks/useChatbot";
import { ChatMessageBubble } from "./ChatMessageBubble";

export function ChatWindow({ messages, isSending }: { messages: ChatDisplayMessage[]; isSending: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isSending]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-1 py-4">
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} />
      ))}
      {isSending && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500">...</div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
