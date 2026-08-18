import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { vi } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Filter, LayoutGrid, PhoneCall, Table2, User, Wallet, ShoppingBag } from "lucide-react";
import { QuickCashierModal } from "../../components/booking/QuickCashierModal";
import { recipientApi, type RecipientBookingGroup, type RecipientCalendarBooking } from "../../features/recipient/api/recipientApi";
import {
  addDays,
  formatLongDayLabel,
  formatWeekRangeLabel,
  formatYmd,
  startOfWeek
} from "../../features/bookings/components/BookingCalendar/utils";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { DatePicker } from "../../components/ui/DatePicker";
import { DayPickerCalendar } from "../../components/ui/DayPickerCalendar";
import { Select } from "../../components/ui/Select";
import { useClickOutside } from "../../hooks/useClickOutside";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { SortableTh } from "../../components/common/SortableTh";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { Overlay } from "../../components/common/Overlay";
import { PageHero } from "../../components/common/PageHero";
import { useUrlSort } from "../../hooks/useUrlSort";
import { BookingCalendarGrid } from "../../components/booking/BookingCalendarGrid";
import { WalkInBookingForm } from "../../features/recipient/components/WalkInBookingForm";
import { RentEquipmentModal } from "../../features/recipient/components/RentEquipmentModal";
import type { Booking } from "../../types/api";

type Action = "confirm" | "reject" | "complete" | "no-show";

type SortField = "customerName" | "bookingDate" | "totalPrice" | "bookingStatus" | "paymentStatus";

const SORT_FIELDS: SortField[] = ["customerName", "bookingDate", "totalPrice", "bookingStatus", "paymentStatus"];

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
}

function addOneHour(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + 60;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function hasCustomerArrived(bookingDate: string, startTime: string) {
  const datePart = bookingDate.slice(0, 10);
  const timePart = startTime.slice(11, 16) || startTime.slice(0, 5);
  const startsAt = new Date(`${datePart}T${timePart}:00`);
  return new Date() >= startsAt;
}

function shiftDate(date: string, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

type RangeMode = "day" | "week" | "month" | "custom";

const rangeModeLabel: Record<RangeMode, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
  custom: "Tuỳ chỉnh"
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

const bookingStatusMeta: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ xác nhận", className: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Đã xác nhận", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Hoàn thành", className: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Đã huỷ", className: "bg-rose-100 text-rose-700" },
  NO_SHOW: { label: "Không đến", className: "bg-rose-100 text-rose-700" }
};

const paymentStatusMeta: Record<string, { label: string; className: string }> = {
  UNPAID: { label: "Chưa thanh toán", className: "bg-slate-100 text-slate-600" },
  PENDING: { label: "Chờ thanh toán", className: "bg-amber-100 text-amber-700" },
  PROCESSING: { label: "Đang xử lý", className: "bg-amber-100 text-amber-700" },
  PAID: { label: "Đã thanh toán", className: "bg-emerald-100 text-emerald-700" },
  FAILED: { label: "Thất bại", className: "bg-rose-100 text-rose-700" },
  EXPIRED: { label: "Hết hạn", className: "bg-rose-100 text-rose-700" },
  CANCELLED: { label: "Đã huỷ", className: "bg-rose-100 text-rose-700" },
  PARTIALLY_REFUNDED: { label: "Hoàn 1 phần", className: "bg-amber-100 text-amber-700" },
  REFUNDED: { label: "Đã hoàn tiền", className: "bg-slate-100 text-slate-600" }
};

export function RecipientBookingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get("view") === "calendar" ? "calendar" : "table";

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [servingOnly, setServingOnly] = useState(false);
  const [cashierBookingId, setCashierBookingId] = useState<string | null>(null);
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [periodAnchor, setPeriodAnchor] = useState(() => new Date());
  const [customFrom, setCustomFrom] = useState(() => currentYearRange().fromDate);
  const [customTo, setCustomTo] = useState(() => currentYearRange().toDate);
  const [confirm, setConfirm] = useState<{ id: string; action: Action } | null>(null);
  const [calendarDetail, setCalendarDetail] = useState<RecipientCalendarBooking | null>(null);
  const [walkInCell, setWalkInCell] = useState<{ courtSurfaceId: string; startTime: string } | null>(null);
  const [orderDetail, setOrderDetail] = useState<RecipientBookingGroup | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => todayValue());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [dayPickerMonth, setDayPickerMonth] = useState(periodAnchor);
  const dayPickerRef = useClickOutside<HTMLSpanElement>(dayPickerOpen, () => setDayPickerOpen(false));

  const openMonthPicker = () => {
    setPickerYear(periodAnchor.getFullYear());
    setMonthPickerOpen(true);
  };

  const setViewMode = (mode: "table" | "calendar") => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("view", mode);
      return next;
    });
  };

  const range = useMemo(() => {
    if (rangeMode === "day") {
      const d = formatYmd(periodAnchor);
      return { fromDate: d, toDate: d };
    }
    if (rangeMode === "week") {
      const start = startOfWeek(periodAnchor);
      return { fromDate: formatYmd(start), toDate: formatYmd(addDays(start, 6)) };
    }
    if (rangeMode === "month") {
      return { fromDate: formatYmd(startOfMonth(periodAnchor)), toDate: formatYmd(endOfMonth(periodAnchor)) };
    }
    return { fromDate: customFrom, toDate: customTo };
  }, [rangeMode, periodAnchor, customFrom, customTo]);

  const periodLabel = useMemo(() => {
    if (rangeMode === "day") return formatLongDayLabel(periodAnchor, "vi");
    if (rangeMode === "week") return formatWeekRangeLabel(startOfWeek(periodAnchor), addDays(startOfWeek(periodAnchor), 6), "vi");
    if (rangeMode === "month") return `Tháng ${periodAnchor.getMonth() + 1}/${periodAnchor.getFullYear()}`;
    return "";
  }, [rangeMode, periodAnchor]);

  const switchRangeMode = (mode: RangeMode) => {
    setRangeMode(mode);
    setPage(1);
    if (mode === "day" || mode === "week") setPeriodAnchor(new Date());
    else if (mode === "month") setPeriodAnchor(startOfMonth(new Date()));
  };

  const shiftPeriod = (direction: 1 | -1) => {
    setPeriodAnchor((current) => {
      const next = new Date(current);
      if (rangeMode === "week") next.setDate(next.getDate() + direction * 7);
      else if (rangeMode === "month") {
        next.setDate(1);
        next.setMonth(next.getMonth() + direction);
      } else next.setDate(next.getDate() + direction);
      return next;
    });
    setPage(1);
  };

  const jumpToTodayPeriod = () => {
    setPeriodAnchor(rangeMode === "month" ? startOfMonth(new Date()) : new Date());
    setPage(1);
  };

  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({
    fields: SORT_FIELDS,
    default: { field: "bookingDate", order: "desc" }
  });
  const handleSort = (field: SortField) => {
    setPage(1);
    sortBy(field);
  };

  const bookings = useQuery({
    queryKey: ["recipient-bookings", page, status, range, sortField, sortOrder],
    queryFn: () =>
      recipientApi.bookings({ page, limit: 10, status, fromDate: range.fromDate, toDate: range.toDate, sortBy: sortField ?? undefined, sortOrder }),
    placeholderData: keepPreviousData,
    enabled: viewMode === "table"
  });

  const displayGroups = useMemo(() => {
    const rawGroups = bookings.data?.items ?? [];
    if (!servingOnly) return rawGroups;
    return rawGroups.filter((group) => {
      const primary = group.bookings[0];
      if (!primary) return false;
      if (!["CONFIRMED", "IN_PROGRESS", "DEPOSIT_PAID", "CHECKOUT_PENDING", "PENDING"].includes(primary.bookingStatus)) return false;
      const startsAt = new Date(`${primary.bookingDate.slice(0, 10)}T${primary.startTime.slice(11, 16)}:00`);
      return new Date() >= startsAt;
    });
  }, [bookings.data?.items, servingOnly]);

  const calendarQuery = useQuery({
    queryKey: ["recipient-calendar", calendarDate],
    queryFn: () => recipientApi.calendar({ fromDate: calendarDate, toDate: calendarDate }),
    enabled: viewMode === "calendar"
  });

  const courtSurfacesQuery = useQuery({
    queryKey: ["recipient-court-surfaces"],
    queryFn: () => recipientApi.courtSurfaces(),
    enabled: viewMode === "calendar"
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["recipient-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["recipient-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["recipient-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["recipient-surface-availability"] });
  };

  const [rentEquipmentBooking, setRentEquipmentBooking] = useState<Booking | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Action }) => {
      if (action === "confirm") return recipientApi.confirmBooking(id);
      if (action === "reject") return recipientApi.rejectBooking(id);
      if (action === "complete") return recipientApi.completeBooking(id);
      return recipientApi.noShowBooking(id);
    },
    onSuccess: () => {
      toast.success("Đã cập nhật đơn đặt sân");
      setConfirm(null);
      setCalendarDetail(null);
      invalidateAll();
    },
    onError: (error: any) => toast.error(error.message || "Có lỗi xảy ra")
  });

  const actionLabel: Record<Action, string> = {
    confirm: "Xác nhận",
    reject: "Hủy/Từ chối",
    complete: "Hoàn thành",
    "no-show": "Khách không đến"
  };

  const actionsForStatus = (status: string): Action[] =>
    status === "PENDING" ? ["confirm", "reject"] : status === "CONFIRMED" ? ["complete", "no-show", "reject"] : [];

  const run = (id: string, action: Action) => {
    if (action === "reject" || action === "no-show") {
      setConfirm({ id, action });
    } else {
      statusMutation.mutate({ id, action });
    }
  };

  const renderBookingRow = (group: RecipientBookingGroup) => {
    const primary = group.bookings[0];
    if (!primary) return null;

    const rowKey = group.orderId ?? primary.id;
    const isGroup = group.bookings.length > 1;
    const totalPrice = group.bookings.reduce((sum, booking) => sum + Number(booking.totalPrice), 0);
    const allSamePayment = group.bookings.every((booking) => booking.paymentStatus === primary.paymentStatus);
    const allSameStatus = group.bookings.every((booking) => booking.bookingStatus === primary.bookingStatus);
    const distinctSurfaceIds = new Set(group.bookings.map((booking) => booking.courtSurface?.id ?? "none"));
    const surfaceLabel =
      distinctSurfaceIds.size === 1
        ? primary.courtSurface
          ? `${primary.courtSurface.name} (${primary.courtSurface.code})`
          : "Chưa gán sân"
        : `${distinctSurfaceIds.size} sân`;

    const bookedTimeLabel = primary.startTime && primary.endTime
      ? `${primary.startTime.slice(11, 16) || primary.startTime.slice(0, 5)} - ${primary.endTime.slice(11, 16) || primary.endTime.slice(0, 5)}`
      : "Chưa chọn giờ";

    return (
      <Tr key={rowKey} className={isGroup ? "bg-emerald-50/40" : undefined}>
        <Td className="font-medium text-slate-800">{primary.user?.fullName}</Td>
        <Td className="text-slate-600">{primary.user?.phone || "Chưa cung cấp"}</Td>
        <Td>
          <span className="font-bold text-slate-800">{surfaceLabel}</span>
          <br />
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#02712a] bg-emerald-50 px-2 py-0.5 rounded-md mt-1 border border-emerald-200">
            <Clock className="h-3 w-3 text-[#02712a]" /> Giờ phục vụ: {bookedTimeLabel}
          </span>
        </Td>
        <Td className="text-slate-600">{group.bookings.length} khung giờ</Td>
        <Td>
          {allSamePayment ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                paymentStatusMeta[primary.paymentStatus]?.className ?? "bg-slate-100 text-slate-600"
              }`}
            >
              {paymentStatusMeta[primary.paymentStatus]?.label ?? primary.paymentStatus}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">Nhiều trạng thái</span>
          )}
        </Td>
        <Td>
          {allSameStatus ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                bookingStatusMeta[primary.bookingStatus]?.className ?? "bg-slate-100 text-slate-600"
              }`}
            >
              {bookingStatusMeta[primary.bookingStatus]?.label ?? primary.bookingStatus}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">Nhiều trạng thái</span>
          )}
        </Td>
        <Td className="text-right font-semibold text-slate-800">{totalPrice.toLocaleString("vi-VN")} đ</Td>
        <Td>
          <div className="flex flex-wrap items-center gap-2">
            {["CONFIRMED", "IN_PROGRESS", "DEPOSIT_PAID", "CHECKOUT_PENDING"].includes(primary.bookingStatus) && (
              <Button
                size="sm"
                className="bg-[#02712a] text-white hover:bg-[#1fa955] font-bold text-xs shadow-sm"
                onClick={() => navigate(`/recipient/pos/${primary.id}`)}
              >
                <ShoppingBag className="mr-1 h-3.5 w-3.5" /> Dịch vụ (POS)
              </Button>
            )}
            {["CONFIRMED", "DEPOSIT_PAID"].includes(primary.bookingStatus) && !hasCustomerArrived(primary.bookingDate, primary.startTime) && (
              <Button
                size="sm"
                variant="secondary"
                className="border-emerald-300 text-[#02712a] hover:bg-emerald-50 font-bold text-xs"
                onClick={() => setRentEquipmentBooking(primary)}
              >
                <ShoppingBag className="mr-1 h-3.5 w-3.5" /> Thuê dụng cụ
              </Button>
            )}
            {!isGroup &&
              actionsForStatus(primary.bookingStatus).map((action) => (
                <Button
                  key={action}
                  variant={action === "reject" || action === "no-show" ? "danger" : "secondary"}
                  disabled={statusMutation.isPending}
                  onClick={() => run(primary.id, action)}
                >
                  {actionLabel[action]}
                </Button>
              ))}
            <Button variant="secondary" onClick={() => setOrderDetail(group)}>
              Chi tiết
            </Button>
          </div>
        </Td>
      </Tr>
    );
  };

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Vận hành"
        title="Quản lý Đơn đặt sân"
        subtitle="Theo dõi, lọc và xử lý các booking cho sân của bạn."
        actions={
          <div className="flex overflow-hidden rounded-xl border border-white/20 bg-white/10 backdrop-blur">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition ${viewMode === "table" ? "bg-white text-emerald-800" : "text-white/80 hover:bg-white/10"}`}
            >
              <Table2 className="h-4 w-4" />
              Bảng
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition ${viewMode === "calendar" ? "bg-white text-emerald-800" : "text-white/80 hover:bg-white/10"}`}
            >
              <CalendarDays className="h-4 w-4" />
              Lịch
            </button>
          </div>
        }
      />

      {viewMode === "table" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            Bộ lọc
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Trạng thái"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
                setServingOnly(false);
              }}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                ...["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((val) => ({
                  value: val,
                  label: bookingStatusMeta[val]?.label ?? val
                }))
              ]}
            />
            <button
              type="button"
              onClick={() => {
                const next = !servingOnly;
                setServingOnly(next);
                setPage(1);
                if (next) setStatus("");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition border ${
                servingOnly
                  ? "bg-[#02712a] text-white border-[#02712a] shadow-md"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Sân đang phục vụ
            </button>
            <div className="flex overflow-hidden rounded-lg border border-emerald-200 text-xs font-bold">
              {(["day", "week", "month", "custom"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => switchRangeMode(mode)}
                  className={`px-3 py-2 transition ${rangeMode === mode ? "bg-emerald-600 text-white" : "bg-white text-emerald-700 hover:bg-emerald-50"}`}
                >
                  {rangeModeLabel[mode]}
                </button>
              ))}
            </div>
          </div>

          {rangeMode === "custom" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <DatePicker
                label="Từ ngày"
                value={customFrom}
                onChange={(value) => {
                  setPage(1);
                  setCustomFrom(value);
                }}
              />
              <DatePicker
                label="Đến ngày"
                value={customTo}
                onChange={(value) => {
                  setPage(1);
                  setCustomTo(value);
                }}
              />
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => shiftPeriod(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="rounded-xl bg-slate-50 px-4 py-1.5 text-sm font-black text-slate-800 ring-1 ring-slate-200">{periodLabel}</span>
              <Button variant="secondary" onClick={() => shiftPeriod(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" onClick={jumpToTodayPeriod}>
                Hôm nay
              </Button>
              {rangeMode === "day" || rangeMode === "week" ? (
                <span className="relative inline-flex" ref={dayPickerRef}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDayPickerMonth(periodAnchor);
                      setDayPickerOpen((o) => !o);
                    }}
                    title="Chọn ngày"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Chọn ngày
                  </Button>
                  {dayPickerOpen && (
                    <DayPickerCalendar
                      required
                      selected={periodAnchor}
                      onSelect={(date) => {
                        setPeriodAnchor(date);
                        setPage(1);
                        setDayPickerOpen(false);
                      }}
                      month={dayPickerMonth}
                      onMonthChange={setDayPickerMonth}
                      locale={vi}
                    />
                  )}
                </span>
              ) : (
                <Button variant="secondary" onClick={openMonthPicker} title="Chọn tháng">
                  <CalendarDays className="h-4 w-4" />
                  Chọn tháng
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            Ngày xem lịch
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setCalendarDate(shiftDate(calendarDate, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DatePicker value={calendarDate} onChange={setCalendarDate} />
            <Button variant="secondary" onClick={() => setCalendarDate(shiftDate(calendarDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" onClick={() => setCalendarDate(todayValue())}>
              Hôm nay
            </Button>
          </div>
        </div>
      )}

      {viewMode === "table" ? (
        bookings.isLoading ? (
          <LoadingState />
        ) : bookings.isError ? (
          <ErrorState message={bookings.error.message} />
        ) : bookings.data?.items.length === 0 ? (
          <EmptyState title="Không tìm thấy đơn đặt sân nào" />
        ) : (
          <>
            <Table minWidth="1180px">
              <THead>
                <tr>
                  <SortableTh label="Khách hàng" field="customerName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <Th>Số điện thoại</Th>
                  <Th>Sân</Th>
                  <Th>Khung giờ</Th>
                  <SortableTh label="Thanh toán" field="paymentStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="Trạng thái" field="bookingStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh className="text-right" label="Tổng cộng" field="totalPrice" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <Th></Th>
                </tr>
              </THead>
              <TBody>{displayGroups.map((group) => renderBookingRow(group))}</TBody>
            </Table>

            {bookings.data && bookings.data.meta.totalPages > 1 && (
              <div className="flex items-center justify-end gap-3 mt-4">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Trang trước
                </Button>
                <span className="text-sm font-medium">
                  Trang {bookings.data.meta.page}/{bookings.data.meta.totalPages}
                </span>
                <Button variant="secondary" disabled={page >= bookings.data.meta.totalPages} onClick={() => setPage(page + 1)}>
                  Trang sau
                </Button>
              </div>
            )}
          </>
        )
      ) : calendarQuery.isLoading || courtSurfacesQuery.isLoading ? (
        <LoadingState />
      ) : calendarQuery.isError ? (
        <ErrorState message={calendarQuery.error.message} />
      ) : (
        <BookingCalendarGrid
          date={calendarDate}
          bookings={calendarQuery.data?.items ?? []}
          courtSurfaces={courtSurfacesQuery.data ?? []}
          opening={calendarQuery.data?.court.openingTime ?? "06:00"}
          closing={calendarQuery.data?.court.closingTime ?? "23:00"}
          onSelectBooking={setCalendarDetail}
          onSelectEmptyCell={(courtSurfaceId, startTime) => setWalkInCell({ courtSurfaceId, startTime })}
        />
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.action === "no-show" ? "Xác nhận khách không đến" : "Xác nhận hủy đơn"}
        message={
          confirm?.action === "no-show"
            ? "Thao tác này xác nhận khách hàng không đến nhận sân và sẽ xử lý cọc nếu có."
            : "Đơn đặt sân sẽ bị hủy bỏ và không thể hoàn tác."
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && statusMutation.mutate(confirm)}
      />

      {calendarDetail ? (
        <Overlay onClose={() => setCalendarDetail(null)}>
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <User className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-black text-slate-800">{calendarDetail.user?.fullName ?? "Khách vãng lai"}</h2>
              {calendarDetail.user?.phone ? (
                <p className="flex items-center gap-1 text-sm text-slate-500">
                  <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                  {calendarDetail.user.phone}
                </p>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                bookingStatusMeta[calendarDetail.bookingStatus]?.className ?? "bg-slate-100 text-slate-600"
              }`}
            >
              {bookingStatusMeta[calendarDetail.bookingStatus]?.label ?? calendarDetail.bookingStatus}
            </span>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p className="flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {calendarDetail.courtSurface ? `${calendarDetail.courtSurface.name} (${calendarDetail.courtSurface.code})` : "Chưa gán sân"}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {calendarDetail.startTime.slice(11, 16)} - {calendarDetail.endTime.slice(11, 16)}
            </p>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  paymentStatusMeta[calendarDetail.paymentStatus]?.className ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {paymentStatusMeta[calendarDetail.paymentStatus]?.label ?? calendarDetail.paymentStatus}
              </span>
              <span className="flex items-center gap-1 font-bold text-slate-800">
                <Wallet className="h-3.5 w-3.5 shrink-0" />
                {Number(calendarDetail.totalPrice).toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {actionsForStatus(calendarDetail.bookingStatus).map((action) => (
              <Button
                key={action}
                variant={action === "reject" || action === "no-show" ? "danger" : "secondary"}
                disabled={statusMutation.isPending}
                onClick={() => run(calendarDetail.id, action)}
              >
                {actionLabel[action]}
              </Button>
            ))}
            {actionsForStatus(calendarDetail.bookingStatus).length === 0 ? <p className="text-sm text-slate-500">Đơn này không còn thao tác nào khả dụng.</p> : null}
          </div>
        </Overlay>
      ) : null}

      {orderDetail ? (
        <Overlay onClose={() => setOrderDetail(null)} widthClassName="max-w-xl">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <User className="h-5 w-5" />
            </span>
            <h2 className="truncate text-base font-black text-slate-800">{orderDetail.bookings[0]?.user?.fullName ?? "Khách vãng lai"}</h2>
          </div>

          <div className="mb-3 flex gap-2">
            <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-500">Số khung giờ</p>
              <p className="text-lg font-black text-slate-800">{orderDetail.bookings.length}</p>
            </div>
            <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-500">Tổng tiền</p>
              <p className="text-lg font-black text-emerald-700">
                {orderDetail.bookings.reduce((sum, booking) => sum + Number(booking.totalPrice), 0).toLocaleString("vi-VN")}đ
              </p>
            </div>
          </div>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {orderDetail.bookings.map((booking) => {
              const statusMeta = bookingStatusMeta[booking.bookingStatus] ?? { label: booking.bookingStatus, className: "bg-slate-100 text-slate-600" };
              const paymentMeta = paymentStatusMeta[booking.paymentStatus] ?? { label: booking.paymentStatus, className: "bg-slate-100 text-slate-600" };
              return (
                <div key={booking.id} className="rounded-xl border border-slate-200 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                      <LayoutGrid className="h-4 w-4 shrink-0 text-slate-400" />
                      {booking.courtSurface ? `${booking.courtSurface.name} (${booking.courtSurface.code})` : "Chưa gán sân"}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {new Date(booking.bookingDate).toLocaleDateString("vi-VN")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {booking.startTime.slice(11, 16)} - {booking.endTime.slice(11, 16)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-bold ${paymentMeta.className}`}>{paymentMeta.label}</span>
                    <span className="ml-auto flex items-center gap-1 font-bold text-slate-700">
                      <Wallet className="h-3.5 w-3.5 shrink-0" />
                      {Number(booking.totalPrice).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                  {booking.bookingServices?.length ? (
                    <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                      <p className="mb-1 text-xs font-semibold text-slate-500">Dịch vụ</p>
                      <div className="max-h-28 overflow-y-auto rounded border border-slate-100">
                        <table className="w-full text-xs">
                          <tbody>
                            {booking.bookingServices.map((item) => (
                              <tr key={item.id} className="border-t border-slate-100 first:border-t-0">
                                <td className="p-1.5 text-slate-700">{item.service.name}</td>
                                <td className="p-1.5 text-right text-slate-500">x{item.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                  {actionsForStatus(booking.bookingStatus).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                      {actionsForStatus(booking.bookingStatus).map((action) => (
                        <Button
                          key={action}
                          variant={action === "reject" || action === "no-show" ? "danger" : "secondary"}
                          disabled={statusMutation.isPending}
                          onClick={() => run(booking.id, action)}
                        >
                          {actionLabel[action]}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Overlay>
      ) : null}

      {monthPickerOpen ? (
        <Overlay onClose={() => setMonthPickerOpen(false)} widthClassName="max-w-sm">
          <h2 className="mb-3 text-base font-black text-slate-800">Chọn tháng</h2>
          <div className="mb-4 flex items-center justify-center gap-4">
            <Button variant="secondary" onClick={() => setPickerYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[4rem] text-center text-lg font-black text-slate-800">{pickerYear}</span>
            <Button variant="secondary" onClick={() => setPickerYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, m) => {
              const isSelected = pickerYear === periodAnchor.getFullYear() && m === periodAnchor.getMonth();
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setPeriodAnchor(new Date(pickerYear, m, 1));
                    setPage(1);
                    setMonthPickerOpen(false);
                  }}
                  className={`rounded-lg px-2 py-2 text-sm font-bold transition ${
                    isSelected ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"
                  }`}
                >
                  {new Date(2000, m, 1).toLocaleDateString("vi-VN", { month: "short" })}
                </button>
              );
            })}
          </div>
        </Overlay>
      ) : null}

      {walkInCell ? (
        <Overlay onClose={() => setWalkInCell(null)}>
          <h2 className="mb-3 text-lg font-bold text-slate-800">Đặt sân tại quầy</h2>
          <WalkInBookingForm
            courtSurfaceId={walkInCell.courtSurfaceId}
            bookingDate={calendarDate}
            initialSlot={{ startTime: walkInCell.startTime, endTime: addOneHour(walkInCell.startTime) }}
            onBookingCreated={invalidateAll}
            onSettled={() => setWalkInCell(null)}
            depositPercent={courtSurfacesQuery.data?.find((s) => s.id === walkInCell.courtSurfaceId)?.depositPercent}
          />
        </Overlay>
      ) : null}
      <QuickCashierModal
        isOpen={Boolean(cashierBookingId)}
        onClose={() => setCashierBookingId(null)}
        bookingId={cashierBookingId}
      />
      <RentEquipmentModal
        isOpen={Boolean(rentEquipmentBooking)}
        onClose={() => setRentEquipmentBooking(null)}
        bookingId={rentEquipmentBooking?.id ?? ""}
        courtId={rentEquipmentBooking?.court.id ?? ""}
        courtName={rentEquipmentBooking?.court.name}
        onRented={() => {
          toast.success("Đã thuê dụng cụ cho khách");
          invalidateAll();
        }}
      />
    </div>
  );
}
