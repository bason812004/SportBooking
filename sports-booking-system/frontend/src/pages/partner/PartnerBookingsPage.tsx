import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { vi } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Eye, LayoutGrid, PhoneCall, ShieldAlert, Table2, User, Wallet, ShoppingBag } from "lucide-react";
import { partnerApi, type PartnerBookingGroup, type PartnerCalendarBooking } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { DatePicker } from "../../components/ui/DatePicker";
import { DayPickerCalendar } from "../../components/ui/DayPickerCalendar";
import { Select } from "../../components/ui/Select";
import { useClickOutside } from "../../hooks/useClickOutside";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { ReasonModal } from "../../components/common/ReasonModal";
import { useDebounce } from "../../hooks/useDebounce";
import { SortableTh } from "../../components/common/SortableTh";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { Overlay } from "../../components/common/Overlay";
import { RowActionsMenu } from "../../components/common/RowActionsMenu";
import { TablePagination } from "../../components/common/TablePagination";
import { useUrlSort } from "../../hooks/useUrlSort";
import { BookingBillSummary } from "../../components/booking/BookingBillSummary";
import { BookingCalendarGrid } from "../../components/booking/BookingCalendarGrid";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PageHero } from "../../components/common/PageHero";
import { canCorrectAutoNoShow, OverdueBookingsPanel } from "../../features/bookings/components/OverdueBookingsPanel";
import { bookingStatusTones, paymentStatusTones } from "../../lib/statusTones";
import { bookingStatusLabel, formatCurrency, localDateKey, paymentStatusLabel } from "../../lib/format";
import {
  addDays,
  formatLongDayLabel,
  formatWeekRangeLabel,
  formatYmd,
  startOfWeek
} from "../../features/bookings/components/BookingCalendar/utils";
import { canRentEquipment, RentEquipmentModal } from "../../features/recipient/components/RentEquipmentModal";
import { useBalanceDueRedirect } from "../../features/cashier/hooks/useBalanceDueRedirect";
import type { Booking } from "../../types/api";

type Action = "confirm" | "reject" | "complete" | "no-show";

type SortField = "customerName" | "bookingDate" | "totalPrice" | "bookingStatus" | "paymentStatus";

const SORT_FIELDS: SortField[] = ["customerName", "bookingDate", "totalPrice", "bookingStatus", "paymentStatus"];

const BOOKING_STATUS_VALUES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];

const bookingStatusLabels = Object.fromEntries(BOOKING_STATUS_VALUES.map((value) => [value, bookingStatusLabel(value)]));
const paymentStatusLabels = Object.fromEntries(Object.keys(paymentStatusTones).map((value) => [value, paymentStatusLabel(value)]));

// Days in the browser's time zone: toISOString would give yesterday before 7am in Vietnam.
function todayValue() {
  return localDateKey();
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
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

export function PartnerBookingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get("view") === "calendar" ? "calendar" : "table";

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [courtId, setCourtId] = useState("");
  const [calendarCourtId, setCalendarCourtId] = useState("");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [periodAnchor, setPeriodAnchor] = useState(() => new Date());
  const [customFrom, setCustomFrom] = useState(() => currentYearRange().fromDate);
  const [customTo, setCustomTo] = useState(() => currentYearRange().toDate);
  const [calendarDate, setCalendarDate] = useState(() => todayValue());
  const [confirm, setConfirm] = useState<{ id: string; action: Action } | null>(null);
  const [calendarDetail, setCalendarDetail] = useState<PartnerCalendarBooking | null>(null);
  const [rowDetail, setRowDetail] = useState<PartnerBookingGroup | null>(null);
  const [servingOnly, setServingOnly] = useState(false);
  const [interveningId, setInterveningId] = useState<string | null>(null);
  const [calendarIntervening, setCalendarIntervening] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });

  const setViewMode = (mode: "table" | "calendar") => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("view", mode);
      return next;
    });
  };

  // Lịch dạng lưới luôn cần đúng 1 sân — tự chọn sân đầu tiên nếu chưa chọn sân nào.
  // Tách riêng khỏi bộ lọc bảng để bảng luôn mặc định "Tất cả sân".
  useEffect(() => {
    if (viewMode === "calendar" && !calendarCourtId && courts.data?.length) {
      setCalendarCourtId(courts.data[0].id);
    }
  }, [viewMode, courts.data, calendarCourtId]);

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

  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [dayPickerMonth, setDayPickerMonth] = useState(periodAnchor);
  const dayPickerRef = useClickOutside<HTMLSpanElement>(dayPickerOpen, () => setDayPickerOpen(false));

  const openMonthPicker = () => {
    setPickerYear(periodAnchor.getFullYear());
    setMonthPickerOpen(true);
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
    queryKey: ["partner-bookings", page, limit, courtId, status, servingOnly, debouncedSearch, range, sortField, sortOrder],
    queryFn: () =>
      partnerApi.bookings({
        page,
        limit,
        courtId,
        status,
        serving: servingOnly ? "true" : undefined,
        search: debouncedSearch,
        fromDate: range.fromDate,
        toDate: range.toDate,
        sortBy: sortField ?? undefined,
        sortOrder
      }),
    placeholderData: keepPreviousData,
    enabled: viewMode === "table"
  });

  // An action (e.g. completing the last order on the last page) can shrink the list under the current page.
  const totalPages = bookings.data?.meta.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const calendarQuery = useQuery({
    queryKey: ["partner-calendar", calendarDate, calendarCourtId],
    queryFn: () => partnerApi.calendar({ fromDate: calendarDate, toDate: calendarDate, courtId: calendarCourtId }),
    enabled: viewMode === "calendar" && Boolean(calendarCourtId)
  });

  const courtSurfacesQuery = useQuery({
    queryKey: ["partner-court-surfaces", calendarCourtId],
    queryFn: () => partnerApi.courtSurfaces(calendarCourtId),
    enabled: viewMode === "calendar" && Boolean(calendarCourtId)
  });

  const overdue = useQuery({ queryKey: ["partner-overdue-bookings"], queryFn: partnerApi.overdueBookings, refetchInterval: 5 * 60_000 });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["partner-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["partner-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["partner-overdue-bookings"] });
  };

  const [rentEquipmentBooking, setRentEquipmentBooking] = useState<Booking | null>(null);

  // A booking still owing money is finished at the cashier, which takes the money first.
  const openCashierIfOwed = useBalanceDueRedirect("/partner/cashier");
  const statusMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: Action; reason?: string }) => partnerApi.setBookingStatus(id, action, reason),
    onSuccess: (_data, variables) => {
      toast.success(variables.action === "reject" ? "Đã huỷ đơn và báo lý do cho khách" : "Đã cập nhật đơn");
      setConfirm(null);
      setCalendarDetail(null);
      invalidateAll();
    },
    onError: (error, variables) => {
      setConfirm(null);
      if (openCashierIfOwed(error, variables.id)) return;
      toast.error(error.message);
      // Changed meanwhile (staff, another tab, the overdue job): show it as it is now.
      invalidateAll();
    }
  });

  const actionLabel: Record<Action, string> = { confirm: "Xác nhận", reject: "Từ chối/Hủy", complete: "Hoàn thành", "no-show": "Khách không đến" };
  // A guest already checked in can only be finished; a no-show the system recorded can be turned into completed
  // for 7 days, if the customer did play. Finishing needs the bill paid (otherwise the cashier opens).
  const actionsForStatus = (status: string, autoFinishedAt?: string | null): Action[] =>
    status === "PENDING"
      ? ["confirm", "reject"]
      : status === "CONFIRMED" || status === "DEPOSIT_PAID"
        ? ["complete", "no-show", "reject"]
        : status === "IN_PROGRESS" || status === "CHECKOUT_PENDING"
          ? ["complete"]
          : canCorrectAutoNoShow({ bookingStatus: status, autoFinishedAt })
            ? ["complete"]
            : [];
  const run = (id: string, action: Action) => (action === "reject" || action === "no-show" ? setConfirm({ id, action }) : statusMutation.mutate({ id, action }));
  const openCalendarDetail = (booking: PartnerCalendarBooking) => {
    setCalendarIntervening(false);
    setCalendarDetail(booking);
  };

  const courtOptions = courts.data?.map((c) => ({ value: c.id, label: c.name })) ?? [];

  const renderBookingRow = (group: PartnerBookingGroup) => {
    const primary = group.bookings[0];
    if (!primary) return null;

    const rowKey = group.orderId ?? primary.id;
    const isGroup = group.bookings.length > 1;
    const billTotal = group.bookings.reduce((sum, b) => sum + b.bill.totalAmount, 0);
    const allSamePayment = group.bookings.every((b) => b.paymentStatus === primary.paymentStatus);
    const allSameStatus = group.bookings.every((b) => b.bookingStatus === primary.bookingStatus);
    const distinctSurfaceIds = new Set(group.bookings.map((b) => b.courtSurface?.id ?? b.court.id));
    const surfaceLabel =
      distinctSurfaceIds.size === 1
        ? `${primary.court.name}${primary.courtSurface ? ` · ${primary.courtSurface.name}` : ""}`
        : `${distinctSurfaceIds.size} sân`;

    return (
      <Tr key={rowKey} className={isGroup ? "bg-emerald-50/40" : undefined}>
        <Td className="font-medium">
          {primary.bookingCode}
          {isGroup ? <span className="ml-1 text-xs font-normal text-slate-400">(+{group.bookings.length - 1})</span> : null}
        </Td>
        <Td className="whitespace-nowrap">
          {primary.user?.fullName}
          <br />
          <span className="text-xs text-slate-500">{primary.user?.phone}</span>
        </Td>
        <Td>
          <span className="font-bold text-slate-800">{surfaceLabel}</span>
        </Td>
        <Td className="whitespace-nowrap">
          {isGroup ? (
            `${group.bookings.length} khung giờ`
          ) : (
            <>
              {new Date(primary.bookingDate).toLocaleDateString("vi-VN")}
              <br />
              <span className="text-xs text-slate-500">
                {primary.startTime.slice(11, 16)} - {primary.endTime.slice(11, 16)}
              </span>
            </>
          )}
        </Td>
        <Td className="whitespace-nowrap">
          {allSamePayment ? (
            <StatusBadge value={primary.paymentStatus} tones={paymentStatusTones} labels={paymentStatusLabels} />
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">Nhiều trạng thái</span>
          )}
        </Td>
        <Td className="whitespace-nowrap">
          {allSameStatus ? (
            <>
              <StatusBadge value={primary.bookingStatus} tones={bookingStatusTones} labels={bookingStatusLabels} />
              {primary.autoFinishedAt && <span className="mt-1 block text-[11px] font-semibold text-slate-500">Hệ thống tự kết thúc</span>}
            </>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">Nhiều trạng thái</span>
          )}
        </Td>
        <Td className="whitespace-nowrap text-right">{formatCurrency(billTotal)}</Td>
        <Td>
          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
            {["CONFIRMED", "IN_PROGRESS", "DEPOSIT_PAID", "CHECKOUT_PENDING"].includes(primary.bookingStatus) && (
              <Button
                size="sm"
                className="bg-[#02712a] text-white hover:bg-[#1fa955] font-bold text-xs shadow-sm"
                onClick={() => navigate(`/partner/cashier?bookingId=${primary.id}`)}
              >
                <ShoppingBag className="mr-1 h-3.5 w-3.5" /> Dịch vụ (POS)
              </Button>
            )}
            <RowActionsMenu
              sections={[
                {
                  items: [
                    ...(canRentEquipment(primary)
                      ? [{ key: "rent", label: "Thuê dụng cụ", icon: ShoppingBag, onClick: () => setRentEquipmentBooking(primary) }]
                      : []),
                    { key: "detail", label: "Chi tiết", icon: Eye, onClick: () => setRowDetail(group) }
                  ]
                },
                {
                  title: "Can thiệp",
                  note: "Ưu tiên để nhân viên phụ trách xử lý khi có thể.",
                  items: isGroup
                    ? []
                    : actionsForStatus(primary.bookingStatus, primary.autoFinishedAt).map((action) => ({
                        key: action,
                        label: actionLabel[action],
                        danger: action === "reject" || action === "no-show",
                        disabled: statusMutation.isPending,
                        onClick: () => run(primary.id, action)
                      }))
                }
              ]}
            />
          </div>
        </Td>
      </Tr>
    );
  };

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Vận hành"
        title="Đơn đặt sân"
        subtitle={'Theo dõi booking theo từng sân, ngày và trạng thái. Dùng "Can thiệp" khi cần xử lý thay nhân viên phụ trách.'}
        actions={
          <div className="flex overflow-hidden rounded-xl border border-line bg-white">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition ${viewMode === "table" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Table2 className="h-4 w-4" />
              Bảng
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition ${viewMode === "calendar" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <CalendarDays className="h-4 w-4" />
              Lịch
            </button>
          </div>
        }
      />

      <OverdueBookingsPanel bookings={overdue.data} />

      {viewMode === "table" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <Select
              label="Sân"
              value={courtId}
              onChange={(e) => {
                setPage(1);
                setCourtId(e.target.value);
              }}
              options={[{ value: "", label: "Tất cả sân" }, ...courtOptions]}
            />
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
                ...BOOKING_STATUS_VALUES.map((val) => ({
                  value: val,
                  label: bookingStatusLabels[val] ?? val
                }))
              ]}
            />
            <Input
              label="Tìm kiếm"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Mã đơn, tên khách hoặc SĐT"
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  const next = !servingOnly;
                  setServingOnly(next);
                  setPage(1);
                  if (next) setStatus("");
                }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition border ${
                  servingOnly
                    ? "bg-[#02712a] text-white border-[#02712a] shadow-md"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Sân đang phục vụ
              </button>
            </div>
          </div>

          <div className={`mt-3 flex flex-wrap gap-3 ${rangeMode === "custom" ? "items-end" : "items-center"}`}>
            <div className="flex overflow-hidden rounded-lg border border-emerald-200 text-xs font-bold w-fit">
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
  
            {rangeMode === "custom" ? (
              <div className="flex flex-wrap items-end gap-3">
                <DatePicker
                  label="Từ ngày"
                  value={customFrom}
                  className="min-w-[11rem]"
                  onChange={(value) => {
                    setPage(1);
                    setCustomFrom(value);
                  }}
                />
                <DatePicker
                  label="Đến ngày"
                  value={customTo}
                  className="min-w-[11rem]"
                  onChange={(value) => {
                    setPage(1);
                    setCustomTo(value);
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
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
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            Ngày xem lịch
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Select label="Sân" value={calendarCourtId} onChange={(e) => setCalendarCourtId(e.target.value)} options={courtOptions} />
            <div className="flex items-center gap-2">
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
        </div>
      )}

      {viewMode === "table" ? (
        bookings.isLoading ? (
          <LoadingState />
        ) : bookings.isError ? (
          <ErrorState message={bookings.error.message} onRetry={() => bookings.refetch()} />
        ) : bookings.data?.items.length === 0 ? (
          <EmptyState title="Chưa có đơn phù hợp" />
        ) : (
          <>
            <Table minWidth="1050px">
              <THead>
                <tr>
                  <Th>Mã</Th>
                  <SortableTh className="whitespace-nowrap" label="Khách hàng" field="customerName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <Th>Sân</Th>
                  <SortableTh className="whitespace-nowrap" label="Khung giờ" field="bookingDate" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh className="whitespace-nowrap" label="Thanh toán" field="paymentStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh className="whitespace-nowrap" label="Trạng thái" field="bookingStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh className="whitespace-nowrap text-right" label="Tổng hoá đơn" field="totalPrice" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <Th></Th>
                </tr>
              </THead>
              <TBody>{bookings.data?.items.map((group) => renderBookingRow(group))}</TBody>
            </Table>

            <TablePagination
              page={page}
              totalPages={bookings.data?.meta.totalPages ?? 1}
              total={bookings.data?.meta.total ?? 0}
              limit={limit}
              itemLabel="đơn"
              onPageChange={setPage}
              onLimitChange={(value) => {
                setPage(1);
                setLimit(value);
              }}
            />
          </>
        )
      ) : !calendarCourtId ? (
        <EmptyState title="Chọn 1 sân để xem lịch dạng lưới giờ" />
      ) : calendarQuery.isLoading || courtSurfacesQuery.isLoading ? (
        <LoadingState />
      ) : calendarQuery.isError ? (
        <ErrorState message={calendarQuery.error.message} onRetry={() => calendarQuery.refetch()} />
      ) : (
        <BookingCalendarGrid
          date={calendarDate}
          bookings={calendarQuery.data?.items ?? []}
          courtSurfaces={courtSurfacesQuery.data ?? []}
          opening={calendarQuery.data?.court.openingTime ?? "06:00"}
          closing={calendarQuery.data?.court.closingTime ?? "23:00"}
          onSelectBooking={openCalendarDetail}
        />
      )}

      <ConfirmModal
        open={confirm?.action === "no-show"}
        title="Xác nhận khách không đến"
        message="Đơn được ghi nhận không đến, tính hoa hồng trên tiền cọc và khách nhận thông báo. Không hoàn tác được."
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && statusMutation.mutate(confirm)}
      />
      <ReasonModal
        key={confirm?.action === "reject" ? `reject-${confirm.id}` : "none"}
        open={confirm?.action === "reject"}
        required
        title="Huỷ đơn đặt sân?"
        description="Đơn bị huỷ và áp dụng chính sách hoàn tiền. Khách nhận thông báo kèm lý do bạn nhập."
        label="Lý do huỷ (gửi cho khách)"
        placeholder="Ví dụ: sân bảo trì đột xuất, xin lỗi vì sự bất tiện"
        confirmLabel="Huỷ đơn"
        pending={statusMutation.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={(reason) => confirm && statusMutation.mutate({ ...confirm, reason })}
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
            <StatusBadge value={calendarDetail.bookingStatus} tones={bookingStatusTones} labels={bookingStatusLabels} />
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p className="flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {calendarDetail.court.name}
              {calendarDetail.courtSurface ? ` · ${calendarDetail.courtSurface.name} (${calendarDetail.courtSurface.code})` : ""}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {calendarDetail.startTime.slice(11, 16)} - {calendarDetail.endTime.slice(11, 16)}
            </p>
            <div className="flex items-center justify-between gap-2 pt-1">
              <StatusBadge value={calendarDetail.paymentStatus} tones={paymentStatusTones} labels={paymentStatusLabels} />
              <span className="flex items-center gap-1 font-bold text-slate-800" title="Chưa gồm dịch vụ thêm tại quầy">
                <Wallet className="h-3.5 w-3.5 shrink-0" />
                Tiền đặt sân: {Number(calendarDetail.totalPrice).toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>

          <div className="mt-4">
            {actionsForStatus(calendarDetail.bookingStatus, calendarDetail.autoFinishedAt).length === 0 ? (
              <p className="text-sm text-slate-500">Đơn này không còn thao tác nào khả dụng.</p>
            ) : calendarIntervening ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-2">
                  {actionsForStatus(calendarDetail.bookingStatus, calendarDetail.autoFinishedAt).map((action) => (
                    <Button key={action} variant={action === "reject" || action === "no-show" ? "danger" : "secondary"} disabled={statusMutation.isPending} onClick={() => run(calendarDetail.id, action)}>
                      {actionLabel[action]}
                    </Button>
                  ))}
                  <Button variant="secondary" onClick={() => setCalendarIntervening(false)}>Đóng</Button>
                </div>
                <p className="text-xs text-amber-700">Đang can thiệp trực tiếp — ưu tiên để nhân viên phụ trách xử lý khi có thể.</p>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setCalendarIntervening(true)}>
                <ShieldAlert className="h-4 w-4" />
                Can thiệp
              </Button>
            )}
          </div>
        </Overlay>
      ) : null}

      {rowDetail ? (
        <Overlay onClose={() => setRowDetail(null)} widthClassName="max-w-xl">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <User className="h-5 w-5" />
            </span>
            <h2 className="truncate text-base font-black text-slate-800">{rowDetail.bookings[0]?.user?.fullName ?? "Khách vãng lai"}</h2>
          </div>

          <div className="mb-3 flex gap-2">
            <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-500">Số khung giờ</p>
              <p className="text-lg font-black text-slate-800">{rowDetail.bookings.length}</p>
            </div>
            <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-500">Tổng hoá đơn</p>
              <p className="text-lg font-black text-slate-800">{formatCurrency(rowDetail.bookings.reduce((sum, b) => sum + b.bill.totalAmount, 0))}</p>
            </div>
            <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-500">Còn phải thu</p>
              <p className={`text-lg font-black ${rowDetail.bookings.some((b) => !b.bill.isFullyPaid) ? "text-amber-700" : "text-emerald-700"}`}>
                {formatCurrency(rowDetail.bookings.reduce((sum, b) => sum + b.bill.remainingAmount, 0))}
              </p>
            </div>
          </div>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {rowDetail.bookings.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-slate-200 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <LayoutGrid className="h-4 w-4 shrink-0 text-slate-400" />
                    {booking.court.name}
                    {booking.courtSurface ? ` · ${booking.courtSurface.name} (${booking.courtSurface.code})` : ""}
                  </div>
                  <StatusBadge value={booking.bookingStatus} tones={bookingStatusTones} labels={bookingStatusLabels} />
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
                  <StatusBadge value={booking.paymentStatus} tones={paymentStatusTones} labels={paymentStatusLabels} />
                </div>

                <div className="mt-2">
                  <BookingBillSummary bill={booking.bill} />
                </div>

                {actionsForStatus(booking.bookingStatus, booking.autoFinishedAt).length > 0 ? (
                  interveningId === booking.id ? (
                    <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                      <div className="flex flex-wrap gap-2">
                        {actionsForStatus(booking.bookingStatus, booking.autoFinishedAt).map((action) => (
                          <Button
                            key={action}
                            variant={action === "reject" || action === "no-show" ? "danger" : "secondary"}
                            disabled={statusMutation.isPending}
                            onClick={() => run(booking.id, action)}
                          >
                            {actionLabel[action]}
                          </Button>
                        ))}
                        <Button variant="secondary" onClick={() => setInterveningId(null)}>Đóng</Button>
                      </div>
                      <p className="text-xs text-amber-700">Đang can thiệp trực tiếp — ưu tiên để nhân viên phụ trách xử lý khi có thể.</p>
                    </div>
                  ) : (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <Button variant="secondary" onClick={() => setInterveningId(booking.id)}>
                        <ShieldAlert className="h-4 w-4" />
                        Can thiệp
                      </Button>
                    </div>
                  )
                ) : null}
              </div>
            ))}
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
      <RentEquipmentModal
        isOpen={Boolean(rentEquipmentBooking)}
        onClose={() => setRentEquipmentBooking(null)}
        bookingId={rentEquipmentBooking?.id ?? ""}
        courtId={rentEquipmentBooking?.court.id ?? ""}
        courtName={rentEquipmentBooking?.court.name}
        onRented={invalidateAll}
      />
    </div>
  );
}
