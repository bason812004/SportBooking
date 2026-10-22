import { useTranslation } from "react-i18next";

export function QuickSuggestions({ isAuthenticated, onPick }: { isAuthenticated: boolean; onPick: (text: string) => void }) {
  const { t } = useTranslation("chat");

  const suggestions = [
    t("suggestions.hours"),
    t("suggestions.cancelPolicy"),
    ...(isAuthenticated ? [t("suggestions.myBookings"), t("suggestions.bookTonight")] : [])
  ];

  return (
    <div className="flex flex-wrap gap-2 px-1 pb-3">
      {suggestions.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
