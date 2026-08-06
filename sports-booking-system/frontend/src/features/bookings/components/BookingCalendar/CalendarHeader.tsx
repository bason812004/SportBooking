import type { CalendarToolbarProps } from "./CalendarToolbar";
import { CalendarToolbar } from "./CalendarToolbar";
import type { WeekHeaderProps } from "./WeekHeader";

export type CalendarHeaderProps = CalendarToolbarProps &
  Pick<WeekHeaderProps, "focusedDate" | "onSelectDay">;

export function CalendarHeader(props: CalendarHeaderProps) {
  return (
    <div className="space-y-3">
      <CalendarToolbar {...props} />
    </div>
  );
}