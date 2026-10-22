import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, X } from "lucide-react";
import { useAuth } from "../../auth/hooks/useAuth";
import { useChatbot } from "../hooks/useChatbot";
import { ChatInput } from "./ChatInput";
import { ChatWindow } from "./ChatWindow";
import { PendingBookingCard } from "./PendingBookingCard";
import { QuickSuggestions } from "./QuickSuggestions";

export function ChatWidget() {
  const { t } = useTranslation("chat");
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const { messages, sendMessage, isSending, pendingBooking, clearPendingBooking, error } = useChatbot();

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-40 right-6 z-50 flex max-h-[600px] w-[calc(100vw-3rem)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-emerald-600 px-4 py-3 text-white">
            <div>
              <p className="font-black">{t("title")}</p>
              <p className="text-xs text-emerald-100">{t("subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-emerald-700"
              aria-label={t("pendingBooking.cancel")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!isAuthenticated && (
            <p className="bg-amber-50 px-4 py-2 text-xs text-amber-800">{t("guestBanner")}</p>
          )}

          <ChatWindow messages={messages} isSending={isSending} />
          {pendingBooking && <PendingBookingCard pendingBooking={pendingBooking} onDismiss={clearPendingBooking} />}
          {error && <p className="px-4 pb-2 text-xs text-rose-600">{t("errorGeneric")}</p>}
          <QuickSuggestions isAuthenticated={isAuthenticated} onPick={sendMessage} />
          <ChatInput onSend={sendMessage} disabled={isSending} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t("title")}
        className="fixed bottom-24 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-900/20 transition duration-200 hover:-translate-y-1 hover:bg-emerald-700"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
