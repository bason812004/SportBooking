import clsx from "clsx";
import { Check, Lock, Unlock } from "lucide-react";
import type { PartnerSurfaceSlot } from "../../features/partner/api/partnerApi";

export type PartnerBlockSelection = { startTime: string; endTime: string };

// TODO(backend): CourtSurface has no per-surface operating hours field yet.
// operatingHours here is mocked from the court cluster's openingTime/closingTime
// (see PartnerCourtResourcesPage.tsx). Once the schema gains a real field, feed
// the real value into `operatingHours` here — this component already renders
// per-row hours independently, no further change needed.
export type ScheduleRow = {
  surfaceId: string;
  surfaceName: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  operatingHours: { open: string; close: string };
  slots: PartnerSurfaceSlot[];
};

type CellStatus = PartnerSurfaceSlot["status"] | "OUT_OF_HOURS";

const cellClass: Record<CellStatus, string> = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 cursor-pointer",
  PENDING_PAYMENT: "border-amber-200 bg-amber-50 cursor-not-allowed",
  BOOKED: "border-red-200 bg-red-50 cursor-not-allowed",
  BLOCKED: "border-slate-300 bg-slate-100 hover:border-slate-400 hover:bg-slate-200 cursor-pointer",
  OUT_OF_HOURS:
    "border-slate-200 cursor-not-allowed bg-[repeating-linear-gradient(45deg,theme(colors.slate.100),theme(colors.slate.100)_4px,theme(colors.slate.50)_4px,theme(colors.slate.50)_8px)]"
};

const statusLabel: Record<CellStatus, string> = {
  AVAILABLE: "Còn trống",
  PENDING_PAYMENT: "Đang giữ chỗ",
  BOOKED: "Đã đặt",
  BLOCKED: "Bị khóa",
  OUT_OF_HOURS: "Ngoài giờ hoạt động"
};

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CourtScheduleGrid({
  rows,
  date,
  selection,
  onToggleSelect,
  onBlockedCellClick,
  onToggleSurfaceStatus,
  toggleSurfaceStatusPending
}: {
  rows: ScheduleRow[];
  date?: string;
  selection: { surfaceId: string; slots: PartnerBlockSelection[] } | null;
  onToggleSelect: (surfaceId: string, slot: PartnerBlockSelection) => void;
  onBlockedCellClick: (surfaceId: string, slot: PartnerSurfaceSlot, anchor: { x: number; y: number }) => void;
  onToggleSurfaceStatus: (surfaceId: string, status: "ACTIVE" | "INACTIVE") => void;
  toggleSurfaceStatusPending: boolean;
}) {
  if (!rows.length) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Chưa có sân con nào để hiển thị.</div>;
  }

  const currentHour = date === todayIso() ? new Date().getHours() : null;

  // Chỉ vẽ các cột giờ mà ít nhất 1 sân con trong danh sách đang mở cửa (phần hợp/union
  // giờ hoạt động), thay vì luôn vẽ đủ 24 cột — tránh cột "ngoài giờ" chết ở mọi hàng.
  const minOpenMinutes = Math.min(...rows.map((row) => toMinutes(row.operatingHours.open)));
  const maxCloseMinutes = Math.max(...rows.map((row) => toMinutes(row.operatingHours.close)));
  const startHour = Math.floor(minOpenMinutes / 60);
  const endHourExclusive = Math.ceil(maxCloseMinutes / 60);
  const visibleHours = Array.from({ length: Math.max(0, endHourExclusive - startHour) }, (_, i) => startHour + i);

  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-white shadow-sm">
      <div className="grid gap-px bg-slate-200 text-xs" style={{ gridTemplateColumns: `200px repeat(${visibleHours.length}, minmax(52px, 1fr))` }}>
        <div className="sticky left-0 top-0 z-30 flex items-center bg-slate-50 px-3 py-2 font-bold text-slate-500">Sân / Giờ</div>
        {visibleHours.map((hour) => (
          <div
            key={hour}
            className={clsx(
              "sticky top-0 z-20 flex flex-col items-center justify-center gap-0 bg-slate-50 py-2",
              currentHour === hour && "bg-teal-50"
            )}
          >
            <span className={clsx("text-[11px] font-black", currentHour === hour ? "text-teal-700" : "text-slate-700")}>
              {hour}:00
            </span>
            <span className={clsx("text-[10px] font-semibold", currentHour === hour ? "text-teal-500" : "text-slate-400")}>
              - {hour + 1}:00
            </span>
          </div>
        ))}

        {rows.map((row, rowIndex) => {
          const openMin = toMinutes(row.operatingHours.open);
          const closeMin = toMinutes(row.operatingHours.close);
          const slotMap = new Map(row.slots.map((slot) => [slot.startTime, slot]));
          const rowSelection = selection?.surfaceId === row.surfaceId ? selection.slots : [];
          const zebra = rowIndex % 2 === 1;

          return (
            <div key={row.surfaceId} className="group contents">
              <div
                className={clsx(
                  "sticky left-0 z-10 flex flex-col justify-center gap-0.5 px-3 py-2.5 transition-colors group-hover:bg-slate-100",
                  zebra ? "bg-slate-50/70" : "bg-white"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-bold text-ink">{row.surfaceName}</p>
                  <button
                    type="button"
                    disabled={toggleSurfaceStatusPending}
                    onClick={() => onToggleSurfaceStatus(row.surfaceId, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                    className={clsx("shrink-0 rounded-full p-1 transition", row.status === "ACTIVE" ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100")}
                    title={row.status === "ACTIVE" ? "Tạm ngưng sân con" : "Kích hoạt lại sân con"}
                  >
                    {row.status === "ACTIVE" ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Mã: {row.code} · {row.operatingHours.open === "00:00" && row.operatingHours.close === "24:00" ? "24/24" : `${row.operatingHours.open}-${row.operatingHours.close}`}
                </p>
              </div>

              {visibleHours.map((hour) => {
                const startTime = `${String(hour).padStart(2, "0")}:00`;
                const endTime = `${String(hour + 1).padStart(2, "0")}:00`;
                const outOfHours = toMinutes(startTime) < openMin || toMinutes(startTime) >= closeMin;
                const slot = slotMap.get(startTime);
                const status: CellStatus = outOfHours ? "OUT_OF_HOURS" : slot?.status ?? "AVAILABLE";
                const isSelected = !outOfHours && status === "AVAILABLE" && rowSelection.some((item) => item.startTime === startTime);
                const clickable = status === "AVAILABLE" || status === "BLOCKED";
                const label = `${row.surfaceName} ${startTime}-${endTime}: ${isSelected ? "Đã chọn" : statusLabel[status]}`;

                return (
                  <button
                    key={startTime}
                    type="button"
                    disabled={!clickable}
                    aria-label={label}
                    aria-disabled={!clickable}
                    title={label}
                    onClick={(event) => {
                      if (status === "AVAILABLE") onToggleSelect(row.surfaceId, { startTime, endTime });
                      else if (status === "BLOCKED" && slot) {
                        const rect = event.currentTarget.getBoundingClientRect();
                        onBlockedCellClick(row.surfaceId, slot, { x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                      }
                    }}
                    className={clsx(
                      "relative h-11 rounded-[3px] transition active:scale-95 group-hover:brightness-95",
                      currentHour === hour && "ring-1 ring-inset ring-teal-300",
                      isSelected ? "bg-teal-600" : cellClass[status]
                    )}
                  >
                    {isSelected && <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
