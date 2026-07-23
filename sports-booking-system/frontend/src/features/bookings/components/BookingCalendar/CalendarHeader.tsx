import type { CalendarToolbarProps } from "./CalendarToolbar";
import { CalendarToolbar } from "./CalendarToolbar";
import type { WeekHeaderProps } from "./WeekHeader";
import { WeekHeader } from "./WeekHeader";

export type CalendarHeaderProps = CalendarToolbarProps &
  Pick<WeekHeaderProps, "focusedDate" | "onSelectDay"> & {
    showWeekHeader: boolean;
  };

export function CalendarHeader(props: CalendarHeaderProps) {
  const { showWeekHeader, ...rest } = props;
  return (
    <div className="space-y-3">
      <CalendarToolbar {...rest} />
      {showWeekHeader && rest.view === "WEEK" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <WeekHeader
            weekStart={rest.weekStart}
            focusedDate={rest.focusedDate}
            language={rest.language}
            onSelectDay={rest.onSelectDay}
          />
        </div>
      )}
    </div>
  );
}