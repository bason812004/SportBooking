import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { chatMessageSchema, type ChatMessageFormValues } from "../schemas/chatMessageSchema";

export function ChatInput({ onSend, disabled }: { onSend: (message: string) => void; disabled?: boolean }) {
  const { t } = useTranslation("chat");
  const { register, handleSubmit, reset } = useForm<ChatMessageFormValues>({
    resolver: zodResolver(chatMessageSchema),
    defaultValues: { message: "" }
  });

  const onSubmit = handleSubmit((values) => {
    onSend(values.message);
    reset();
  });

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
      <input
        {...register("message")}
        placeholder={t("placeholder")}
        disabled={disabled}
        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={disabled}
        className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-50"
        aria-label={t("send")}
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}
