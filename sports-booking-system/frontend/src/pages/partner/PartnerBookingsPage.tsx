import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, ShieldAlert, Table2, X } from "lucide-react";
import { partnerApi, type PartnerCalendarBooking } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { SortableTh } from "../../components/common/SortableTh";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { useUrlSort } from "../../hooks/useUrlSort";
import { BookingCalendarGrid } from "../../components/booking/BookingCalendarGrid";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PageHero } from "../../components/common/PageHero";
import { bookingStatusTones, paymentStatusTones } from "../../lib/statusTones";

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

function shiftDate(date: string, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onMouseDown={onClose}>
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function PartnerBookingsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get("view") === "calendar" ? "calendar" : "table";

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(() => ({
    courtId: "",
    status: searchParams.get("status") ?? "PENDING",
    search: "",
    ...currentYearRange()
  }));
  const [confirm, setConfirm] = useState<{ id: string; action: Action } | null>(null);
  const [calendarDetail, setCalendarDetail] = useState<PartnerCalendarBooking | null>(null);
  const [interveningId, setInterveningId] = useState<string | null>(null);
  const [calendarIntervening, setCalendarIntervening] = useState(false);
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });

  const setViewMode = (mode: "table" | "calendar") => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("view", mode);
      return next;
    });
  };

  // Lịch dạng lưới luôn cần đúng 1 sân — tự chọn sân đầu tiên nếu chưa chọn sân nào.
  useEffect(() => {
    if (viewMode === "calendar" && !filters.courtId && courts.data?.length) {
      setFilters((current) => ({ ...current, courtId: courts.data![0].id }));
    }
  }, [viewMode, courts.data, filters.courtId]);

  const isSingleDayRange = Boolean(filters.fromDate) && filters.fromDate === filters.toDate;
  const calendarDate = isSingleDayRange ? filters.fromDate : todayValue();
  const setCalendarDate = (date: string) => setFilters((current) => ({ ...current, fromDate: date, toDate: date }));

  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({
    fields: SORT_FIELDS,
    default: { field: "bookingDate", order: "desc" }
  });
  const handleSort = (field: SortField) => {
    setPage(1);
    sortBy(field);
  };

  const bookings = useQuery({
    queryKey: ["partner-bookings", page, filters, sortField, sortOrder],
    queryFn: () => partnerApi.bookings({ page, limit: 10, ...filters, sortBy: sortField ?? undefined, sortOrder }),
    placeholderData: keepPreviousData,
    enabled: viewMode === "table"
  });

  const calendarQuery = useQuery({
    queryKey: ["partner-calendar", calendarDate, filters.courtId],
    queryFn: () => partnerApi.calendar({ fromDate: calendarDate, toDate: calendarDate, courtId: filters.courtId }),
    enabled: viewMode === "calendar" && Boolean(filters.courtId)
  });

  const courtSurfacesQuery = useQuery({
    queryKey: ["partner-court-surfaces", filters.courtId],
    queryFn: () => partnerApi.courtSurfaces(filters.courtId),
    enabled: viewMode === "calendar" && Boolean(filters.courtId)
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["partner-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["partner-calendar"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Action }) => partnerApi.setBookingStatus(id, action),
    onSuccess: () => {
      toast.success("Đã cập nhật đơn");
      setConfirm(null);
      setCalendarDetail(null);
      invalidateAll();
    },
    onError: (error) => toast.error(error.message)
  });

  const actionLabel: Record<Action, string> = { confirm: "Xác nhận", reject: "Từ chối/Hủy", complete: "Hoàn thành", "no-show": "Khách không đến" };
  const actionsForStatus = (status: string): Action[] =>
    status === "PENDING" ? ["confirm", "reject"] : status === "CONFIRMED" ? ["complete", "no-show", "reject"] : [];
  const run = (id: string, action: Action) => (action === "reject" || action === "no-show" ? setConfirm({ id, action }) : statusMutation.mutate({ id, action }));
  const openCalendarDetail = (booking: PartnerCalendarBooking) => {
    setCalendarIntervening(false);
    setCalendarDetail(booking);
  };

  const courtOptions = courts.data?.map((c) => ({ value: c.id, label: c.name })) ?? [];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Vận hành"
        title="Đơn đặt sân"
        subtitle={'Theo dõi booking theo từng sân, ngày và trạng thái. Dùng "Can thiệp" khi cần xử lý thay nhân viên phụ trách.'}
        actions={
          <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
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

      {viewMode === "table" ? (
        <div className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-4">
          <Select label="Sân" value={filters.courtId} onChange={(e) => { setPage(1); setFilters({ ...filters, courtId: e.target.value }); }} options={[{ value: "", label: "Tất cả sân" }, ...courtOptions]} />
          <Select
            label="Trạng thái"
            value={filters.status}
            onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}
            options={[{ value: "", label: "Tất cả" }, ...["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((value) => ({ value, label: value }))]}
          />
          <Input label="Từ ngày" type="date" value={filters.fromDate} onChange={(e) => { setPage(1); setFilters({ ...filters, fromDate: e.target.value }); }} />
          <Input label="Đến ngày" type="date" value={filters.toDate} onChange={(e) => { setPage(1); setFilters({ ...filters, toDate: e.target.value }); }} />
          <div className="md:col-span-4">
            <Input label="Tìm kiếm" value={filters.search} onChange={(e) => { setPage(1); setFilters({ ...filters, search: e.target.value }); }} placeholder="Mã đơn, tên khách hoặc SĐT" />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
          <Select label="Sân" value={filters.courtId} onChange={(e) => setFilters({ ...filters, courtId: e.target.value })} options={courtOptions} />
          <Button variant="secondary" onClick={() => setCalendarDate(shiftDate(calendarDate, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input label="Ngày xem lịch" type="date" value={calendarDate} onChange={(e) => setCalendarDate(e.target.value)} />
          <Button variant="secondary" onClick={() => setCalendarDate(shiftDate(calendarDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={() => setCalendarDate(todayValue())}>
            Hôm nay
          </Button>
        </div>
      )}

      {viewMode === "table" ? (
        bookings.isLoading ? (
          <LoadingState />
        ) : bookings.isError ? (
          <ErrorState message={bookings.error.message} />
        ) : bookings.data?.items.length === 0 ? (
          <EmptyState title="Chưa có đơn phù hợp" />
        ) : (
          <>
            <Table minWidth="1050px">
              <THead>
                <tr>
                  <Th>Mã</Th>
                  <SortableTh label="Khách hàng" field="customerName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <Th>Sân</Th>
                  <SortableTh label="Ngày chơi" field="bookingDate" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <Th>Thời gian</Th>
                  <SortableTh label="Thanh toán" field="paymentStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="Trạng thái" field="bookingStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh className="text-right" label="Tổng tiền" field="totalPrice" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <Th></Th>
                </tr>
              </THead>
              <TBody>
                {bookings.data?.items.map((booking) => (
                  <Tr key={booking.id}>
                    <Td className="font-medium">{booking.bookingCode}</Td>
                    <Td>
                      {booking.user?.fullName}
                      <br />
                      <span className="text-xs text-slate-500">{booking.user?.phone}</span>
                    </Td>
                    <Td>{booking.court.name}</Td>
                    <Td>{new Date(booking.bookingDate).toLocaleDateString("vi-VN")}</Td>
                    <Td>{booking.startTime.slice(11, 16)}-{booking.endTime.slice(11, 16)}</Td>
                    <Td><StatusBadge value={booking.paymentStatus} tones={paymentStatusTones} /></Td>
                    <Td><StatusBadge value={booking.bookingStatus} tones={bookingStatusTones} /></Td>
                    <Td className="text-right">{Number(booking.totalPrice).toLocaleString("vi-VN")} đ</Td>
                    <Td>
                      {actionsForStatus(booking.bookingStatus).length === 0 ? null : interveningId === booking.id ? (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-2">
                            {actionsForStatus(booking.bookingStatus).map((action) => (
                              <Button key={action} variant={action === "reject" || action === "no-show" ? "danger" : "secondary"} disabled={statusMutation.isPending} onClick={() => run(booking.id, action)}>
                                {actionLabel[action]}
                              </Button>
                            ))}
                            <Button variant="secondary" onClick={() => setInterveningId(null)}>Đóng</Button>
                          </div>
                          <p className="text-xs text-amber-700">Đang can thiệp trực tiếp — ưu tiên để nhân viên phụ trách xử lý khi có thể.</p>
                        </div>
                      ) : (
                        <Button variant="secondary" onClick={() => setInterveningId(booking.id)}>
                          <ShieldAlert className="h-4 w-4" />
                          Can thiệp
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>

            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</Button>
              <span>Trang {bookings.data?.meta.page}/{Math.max(bookings.data?.meta.totalPages ?? 1, 1)}</span>
              <Button variant="secondary" disabled={page >= (bookings.data?.meta.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Trang sau</Button>
            </div>
          </>
        )
      ) : !filters.courtId ? (
        <EmptyState title="Chọn 1 sân để xem lịch dạng lưới giờ" />
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
          onSelectBooking={openCalendarDetail}
        />
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.action === "no-show" ? "Xác nhận khách không đến" : "Xác nhận hủy đơn"}
        message={confirm?.action === "no-show" ? "Thao tác này tạo hoa hồng trên tiền cọc và không thể hoàn tác." : "Đơn sẽ bị hủy và áp dụng chính sách hoàn tiền."}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && statusMutation.mutate(confirm)}
      />

      {calendarDetail ? (
        <Overlay onClose={() => setCalendarDetail(null)}>
          <h2 className="text-lg font-bold text-slate-800">{calendarDetail.user?.fullName ?? "Khách vãng lai"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {calendarDetail.startTime.slice(11, 16)} - {calendarDetail.endTime.slice(11, 16)} · {calendarDetail.court.name} ·{" "}
            {calendarDetail.courtSurface ? `${calendarDetail.courtSurface.name} (${calendarDetail.courtSurface.code})` : "Chưa gán sân con"}
          </p>
          <div className="mt-3 space-y-1.5 text-sm text-slate-600">
            <p>SĐT: {calendarDetail.user?.phone || "Chưa cung cấp"}</p>
            <p className="flex items-center gap-2">Thanh toán: <StatusBadge value={calendarDetail.paymentStatus} tones={paymentStatusTones} /></p>
            <p>Tổng tiền: {Number(calendarDetail.totalPrice).toLocaleString("vi-VN")} đ</p>
          </div>
          <div className="mt-4">
            {actionsForStatus(calendarDetail.bookingStatus).length === 0 ? (
              <p className="text-sm text-slate-500">Đơn này không còn thao tác nào khả dụng.</p>
            ) : calendarIntervening ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-2">
                  {actionsForStatus(calendarDetail.bookingStatus).map((action) => (
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
    </div>
  );
}
