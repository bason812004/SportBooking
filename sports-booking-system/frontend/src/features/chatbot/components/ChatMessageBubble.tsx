import type { ChatDisplayMessage } from "../hooks/useChatbot";

export function ChatMessageBubble({ message }: { message: ChatDisplayMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-900"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
