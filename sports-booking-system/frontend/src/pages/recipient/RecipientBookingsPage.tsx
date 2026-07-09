import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Table2, X } from "lucide-react";
import { recipientApi, type RecipientCalendarBooking } from "../../features/recipient/api/recipientApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { SortableTh } from "../../components/common/SortableTh";
import { useUrlSort } from "../../hooks/useUrlSort";
import { BookingCalendarGrid } from "../../features/recipient/components/BookingCalendarGrid";
import { WalkInBookingForm } from "../../features/recipient/components/WalkInBookingForm";

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

function shiftDate(date: string, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

const defaultFilters = { status: "CONFIRMED", ...currentYearRange() };

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

export function RecipientBookingsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get("view") === "calendar" ? "calendar" : "table";

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(defaultFilters);
  const [confirm, setConfirm] = useState<{ id: string; action: Action } | null>(null);
  const [calendarDetail, setCalendarDetail] = useState<RecipientCalendarBooking | null>(null);
  const [walkInCell, setWalkInCell] = useState<{ courtSurfaceId: string; startTime: string } | null>(null);

  const setViewMode = (mode: "table" | "calendar") => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("view", mode);
      return next;
    });
  };

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
    queryKey: ["recipient-bookings", page, filters, sortField, sortOrder],
    queryFn: () => recipientApi.bookings({ page, limit: 10, ...filters, sortBy: sortField ?? undefined, sortOrder }),
    placeholderData: keepPreviousData,
    enabled: viewMode === "table"
  });

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
  };

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Quản lý Đơn đặt sân</h1>
          <p className="text-slate-600">Theo dõi, lọc và xử lý các booking cho sân của bạn.</p>
        </div>
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
      </div>

      {viewMode === "table" ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
          <Select
            label="Trạng thái"
            value={filters.status}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, status: e.target.value });
            }}
            options={[
              { value: "", label: "Tất cả trạng thái" },
              ...["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((val) => ({ value: val, label: val }))
            ]}
          />
          <Input
            label="Từ ngày"
            type="date"
            value={filters.fromDate}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, fromDate: e.target.value });
            }}
          />
          <Input
            label="Đến ngày"
            type="date"
            value={filters.toDate}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, toDate: e.target.value });
            }}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
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
          <EmptyState title="Không tìm thấy đơn đặt sân nào" />
        ) : (
          <>
            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[1180px] text-sm text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <SortableTh className="p-3 font-semibold text-slate-600" label="Khách hàng" field="customerName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <th className="p-3 font-semibold text-slate-600">Số điện thoại</th>
                    <th className="p-3 font-semibold text-slate-600">Sân con</th>
                    <SortableTh className="p-3 font-semibold text-slate-600" label="Ngày chơi" field="bookingDate" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <th className="p-3 font-semibold text-slate-600">Thời gian</th>
                    <SortableTh className="p-3 font-semibold text-slate-600" label="Thanh toán" field="paymentStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableTh className="p-3 font-semibold text-slate-600" label="Trạng thái" field="bookingStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableTh className="p-3 font-semibold text-slate-600 text-right" label="Tổng cộng" field="totalPrice" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.data?.items.map((booking) => (
                    <tr key={booking.id} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{booking.user?.fullName}</td>
                      <td className="p-3 text-slate-600">{booking.user?.phone || "Chưa cung cấp"}</td>
                      <td className="p-3 text-slate-600">{booking.courtSurface ? `${booking.courtSurface.name} (${booking.courtSurface.code})` : "Chưa gán sân con"}</td>
                      <td className="p-3 text-slate-600">{new Date(booking.bookingDate).toLocaleDateString("vi-VN")}</td>
                      <td className="p-3 text-slate-600">{`${booking.startTime.slice(11, 16)} - ${booking.endTime.slice(11, 16)}`}</td>
                      <td className="p-3 text-slate-600">{booking.paymentStatus}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            booking.bookingStatus === "CONFIRMED"
                              ? "bg-blue-100 text-blue-800"
                              : booking.bookingStatus === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : booking.bookingStatus === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {booking.bookingStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-800">{Number(booking.totalPrice).toLocaleString("vi-VN")} đ</td>
                      <td className="p-3">
                        <div className="flex gap-2">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
          <h2 className="text-lg font-bold text-slate-800">{calendarDetail.user?.fullName ?? "Khách vãng lai"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {calendarDetail.startTime.slice(11, 16)} - {calendarDetail.endTime.slice(11, 16)} · {calendarDetail.courtSurface ? `${calendarDetail.courtSurface.name} (${calendarDetail.courtSurface.code})` : "Chưa gán sân con"}
          </p>
          <div className="mt-3 space-y-1.5 text-sm text-slate-600">
            <p>SĐT: {calendarDetail.user?.phone || "Chưa cung cấp"}</p>
            <p>Thanh toán: {calendarDetail.paymentStatus}</p>
            <p>Tổng tiền: {Number(calendarDetail.totalPrice).toLocaleString("vi-VN")} đ</p>
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

      {walkInCell ? (
        <Overlay onClose={() => setWalkInCell(null)}>
          <h2 className="mb-3 text-lg font-bold text-slate-800">Đặt sân tại quầy</h2>
          <WalkInBookingForm
            courtSurfaceId={walkInCell.courtSurfaceId}
            bookingDate={calendarDate}
            initialSlot={{ startTime: walkInCell.startTime, endTime: addOneHour(walkInCell.startTime) }}
            onBookingCreated={invalidateAll}
            onSettled={() => setWalkInCell(null)}
          />
        </Overlay>
      ) : null}
    </div>
  );
}
