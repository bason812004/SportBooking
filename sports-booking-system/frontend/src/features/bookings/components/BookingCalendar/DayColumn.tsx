import clsx from "clsx";
import type { WeeklyScheduleDay } from "../../../../types/api";
import { BookingBlock } from "./BookingBlock";
import type { Language } from "./utils";

export type DayColumnProps = {
  day: WeeklyScheduleDay | undefined;
  hours: string[];
  selectedKeys: Set<string>;
  onToggle?: (slot: WeeklyScheduleDay["slots"][number]) => void;
  language: Language;
};

export function DayColumn({ day, hours, selectedKeys, onToggle, language }: DayColumnProps) {
  const slotByHour = new Map<string, WeeklyScheduleDay["slots"][number]>();
  if (day) {
    for (const slot of day.slots) slotByHour.set(slot.startTime, slot);
  }
  return (
    <div className={clsx("flex flex-col", !day && "bg-slate-50/60")} role="grid" aria-label="day-column">
      {hours.map((hour) => {
        const slot = slotByHour.get(hour);
        return (
          <BookingBlock
            key={`${day?.date ?? "na"}-${hour}`}
            slot={slot}
            selected={slot ? selectedKeys.has(`${slot.date}#${slot.startTime}`) : false}
            onToggle={onToggle}
            language={language}
          />
        );
      })}
    </div>
  );
}