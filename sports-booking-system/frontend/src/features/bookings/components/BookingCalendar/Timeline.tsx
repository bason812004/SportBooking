import clsx from "clsx";
import type { Language } from "./utils";

export type TimelineProps = {
  hours: string[];
  language: Language;
  highlightHour?: string;
};

export function Timeline({ hours, language, highlightHour }: TimelineProps) {
  return (
    <div className="flex flex-col border-r border-slate-100">
      {hours.map((hour) => (
        <div
          key={hour}
          className={clsx(
            "flex h-12 items-center justify-center border-b border-slate-100 bg-slate-50 text-[11px] font-black tracking-wide text-slate-500",
            highlightHour === hour && "bg-emerald-50 text-emerald-700"
          )}
          aria-label={hour}
        >
          {hour}
        </div>
      ))}
      {language === "en" ? (
        <span className="sr-only">Hour of day</span>
      ) : (
        <span className="sr-only">Giờ trong ngày</span>
      )}
    </div>
  );
}