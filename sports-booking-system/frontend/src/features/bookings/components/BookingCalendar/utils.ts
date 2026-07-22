import type {
  WeeklyScheduleDay,
  WeeklyScheduleSlot,
  WeeklyScheduleResponse
} from "../../../../types/api";

export type Language = "vi" | "en";

export const WEEK_DAY_LABELS_VI = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
export const WEEK_DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function startOfWeek(date: Date | string) {
  const base = typeof date === "string" ? new Date(`${date}T00:00:00`) : new Date(date);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  return base;
}

export function addDays(date: Date | string, days: number) {
  const base = typeof date === "string" ? new Date(`${date}T00:00:00`) : new Date(date);
  base.setDate(base.getDate() + days);
  return base;
}

export function formatYmd(date: Date | string) {
  const base = typeof date === "string" ? new Date(`${date}T00:00:00`) : new Date(date);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function buildWeekDates(weekStart: Date) {
  return Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
}

export function slotKey(slot: { date: string; startTime: string }) {
  return `${slot.date}#${slot.startTime}`;
}

export function compareTime(a: string, b: string) {
  return a.localeCompare(b);
}

export function isSlotSelectable(slot: WeeklyScheduleSlot) {
  return slot.status === "AVAILABLE";
}

export function formatWeekRangeLabel(start: Date, end: Date, language: Language) {
  const options = language === "en"
    ? { month: "short", day: "2-digit", year: "numeric" } as const
    : { day: "2-digit", month: "2-digit", year: "numeric" } as const;
  const fmt = new Intl.DateTimeFormat(language === "en" ? "en-US" : "vi-VN", options);
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

export function formatDayLabel(date: Date, language: Language) {
  return date.toLocaleDateString(language === "en" ? "en-US" : "vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

export function formatLongDayLabel(date: Date, language: Language) {
  return date.toLocaleDateString(language === "en" ? "en-US" : "vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

export function buildHours(openingTime: string, closingTime: string) {
  const start = Number(openingTime.slice(0, 2));
  const end = Number(closingTime.slice(0, 2));
  const hours: string[] = [];
  for (let hour = start; hour < end; hour += 1) {
    hours.push(`${String(hour).padStart(2, "0")}:00`);
  }
  return hours;
}

export function findDay(response: WeeklyScheduleResponse, date: string): WeeklyScheduleDay | undefined {
  return response.days.find((day) => day.date === date);
}

export function predictionLabel(level: WeeklyScheduleSlot["predictionLevel"], language: Language) {
  if (!level) return language === "en" ? "N/A" : "Không rõ";
  const map: Record<string, { vi: string; en: string }> = {
    LOW: { vi: "Thấp", en: "Low" },
    MEDIUM: { vi: "Trung bình", en: "Medium" },
    HIGH: { vi: "Cao", en: "High" },
    VERY_HIGH: { vi: "Rất cao", en: "Very high" }
  };
  return map[level]?.[language] ?? level;
}

export function predictionAccent(level: WeeklyScheduleSlot["predictionLevel"]) {
  switch (level) {
    case "VERY_HIGH": return { vi: "Rất kín", en: "Very busy", className: "bg-rose-100 text-rose-700" };
    case "HIGH": return { vi: "Kín sân", en: "Busy", className: "bg-amber-100 text-amber-700" };
    case "MEDIUM": return { vi: "Bình thường", en: "Steady", className: "bg-emerald-50 text-emerald-700" };
    case "LOW": return { vi: "Vắng", en: "Quiet", className: "bg-slate-100 text-slate-700" };
    default: return null;
  }
}

export function statusLabel(status: WeeklyScheduleSlot["status"], language: Language) {
  const map: Record<WeeklyScheduleSlot["status"], { vi: string; en: string }> = {
    AVAILABLE: { vi: "Còn trống", en: "Available" },
    BOOKED: { vi: "Đã đặt", en: "Booked" },
    BLOCKED: { vi: "Bị khoá", en: "Blocked" },
    MAINTENANCE: { vi: "Bảo trì", en: "Maintenance" },
    OUTSIDE_HOURS: { vi: "Đã qua", en: "Past" },
    HELD: { vi: "Đang giữ", en: "Held" }
  };
  return map[status][language];
}

export function sortSelectedByTime(slots: WeeklyScheduleSlot[]) {
  return [...slots].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
}