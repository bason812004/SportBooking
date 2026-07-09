import { useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import type { AdminBooking } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { SortableTh } from "../../components/common/SortableTh";
import { useUrlSort } from "../../hooks/useUrlSort";

const bookingStatuses = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const paymentStatuses = ["UNPAID", "PAID", "PARTIALLY_REFUNDED", "REFUNDED"];

const bookingStatusLabels: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  NO_SHOW: "Không đến"
};

const paymentStatusLabels: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  PARTIALLY_REFUNDED: "Hoàn tiền một phần",
  REFUNDED: "Đã hoàn tiền"
};

type Filters = {
  search: string;
  fromDate: string;
  toDate: string;
  courtId: string;
  partnerId: string;
  userId: string;
  paymentStatus: string;
  bookingStatus: string;
};

type BookingAdminForm = {
  bookingStatus: string;
  paymentStatus: string;
  adminNote: string;
  cancelReason: string;
  refundAmount: string;
  platformRetainedAmount: string;
  actionNote: string;
};

function currentYearRange() {
  const year = new Date().getFullYear();
  return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
}

const defaultFilters: Filters = {
  search: "",
  ...currentYearRange(),
  courtId: "",
  partnerId: "",
  userId: "",
  paymentStatus: "",
  bookingStatus: ""
};

type SortField = "bookingCode" | "customerName" | "bookingDate" | "totalPrice" | "bookingStatus" | "paymentStatus";

const SORT_FIELDS: SortField[] = ["bookingCode", "customerName", "bookingDate", "totalPrice", "bookingStatus", "paymentStatus"];

export function AdminBookingsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({
    fields: SORT_FIELDS,
    default: { field: "bookingDate", order: "desc" }
  });
  const handleSort = (field: SortField) => {
    setPage(1);
    sortBy(field);
  };

  const list = useQuery({
    queryKey: ["admin-bookings", page, filters, sortField, sortOrder],
    queryFn: () => adminApi.bookings({ page, limit: 10, ...filters, sortBy: sortField ?? undefined, sortOrder }),
    placeholderData: keepPreviousData
  });
  const detail = useQuery({
    queryKey: ["admin-booking", selected],
    queryFn: () => adminApi.bookingDetail(selected!),
    enabled: Boolean(selected)
  });

  if (list.isLoading) return <LoadingState />;
  if (list.isError) return <ErrorState message={list.error.message} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Quản lý đơn đặt sân</h1>
          <p className="text-sm text-slate-600">Theo dõi, lọc và xử lý booking toàn hệ thống.</p>
        </div>
        <Button variant="secondary" onClick={() => { setPage(1); setFilters(defaultFilters); }}>
          Xóa lọc
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
        <Input label="Tìm kiếm" value={filters.search} onChange={(event) => updateFilter(setPage, setFilters, "search", event.target.value)} placeholder="Mã đơn, khách, sân, đối tác" />
        <Input label="Từ ngày" type="date" value={filters.fromDate} onChange={(event) => updateFilter(setPage, setFilters, "fromDate", event.target.value)} />
        <Input label="Đến ngày" type="date" value={filters.toDate} onChange={(event) => updateFilter(setPage, setFilters, "toDate", event.target.value)} />
        <Input label="ID sân" value={filters.courtId} onChange={(event) => updateFilter(setPage, setFilters, "courtId", event.target.value)} placeholder="c0001" />
        <Input label="ID đối tác" value={filters.partnerId} onChange={(event) => updateFilter(setPage, setFilters, "partnerId", event.target.value)} placeholder="pp0001" />
        <Input label="ID người dùng" value={filters.userId} onChange={(event) => updateFilter(setPage, setFilters, "userId", event.target.value)} placeholder="u0001" />
        <Select label="Thanh toán" value={filters.paymentStatus} onChange={(event) => updateFilter(setPage, setFilters, "paymentStatus", event.target.value)} options={withAll(paymentStatuses, paymentStatusLabels)} />
        <Select label="Trạng thái đơn" value={filters.bookingStatus} onChange={(event) => updateFilter(setPage, setFilters, "bookingStatus", event.target.value)} options={withAll(bookingStatuses, bookingStatusLabels)} />
      </div>

      <div className="overflow-auto rounded-lg border bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <SortableTh className="p-3" label="Mã đơn" field="bookingCode" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <SortableTh label="Khách hàng" field="customerName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <th>Sân / đối tác</th>
              <SortableTh label="Lịch đặt" field="bookingDate" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <SortableTh label="Tổng tiền" field="totalPrice" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <SortableTh label="Đơn" field="bookingStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <SortableTh label="Thanh toán" field="paymentStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((booking) => (
              <tr key={booking.id} className="border-t align-top">
                <td className="p-3 font-bold">{booking.bookingCode}</td>
                <td>{booking.user?.fullName}<br /><span className="text-xs text-slate-500">{booking.user?.email}</span></td>
                <td>{booking.court.name}<br /><span className="text-xs text-slate-500">{booking.court.partner?.businessName}</span></td>
                <td>{formatDate(booking.bookingDate)}<br /><span className="text-xs text-slate-500">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span></td>
                <td>{formatMoney(booking.totalPrice)}</td>
                <td><StatusBadge value={booking.bookingStatus} labels={bookingStatusLabels} /></td>
                <td><StatusBadge value={booking.paymentStatus} labels={paymentStatusLabels} /></td>
                <td className="p-3 text-right">
                  <Button variant="secondary" onClick={() => setSelected(booking.id)}>
                    Chi tiết
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.data?.items.length && <p className="p-6 text-center text-slate-500">Không có đơn đặt sân phù hợp</p>}
      </div>

      <Pager page={page} total={list.data?.meta.totalPages ?? 1} setPage={setPage} />

      <BookingDetailModal open={Boolean(selected)} onClose={() => setSelected(null)}>
        {detail.isLoading && <LoadingState />}
        {detail.isError && <ErrorState message={detail.error.message} />}
        {detail.data && (
          <BookingDetail
            booking={detail.data}
            onUpdated={async () => {
              await queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
              await queryClient.invalidateQueries({ queryKey: ["admin-booking", selected] });
            }}
          />
        )}
      </BookingDetailModal>
    </div>
  );
}

function BookingDetailModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onMouseDown={onClose}>
      <div className="relative flex max-h-[calc(100vh-48px)] w-full max-w-7xl flex-col rounded-lg bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h2 className="text-xl font-bold">Chi tiết đơn đặt sân</h2>
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function BookingDetail({ booking, onUpdated }: { booking: AdminBooking; onUpdated: () => Promise<void> }) {
  const [form, setForm] = useState<BookingAdminForm>({
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    adminNote: booking.adminNote ?? "",
    cancelReason: booking.cancelReason ?? "",
    refundAmount: numberText(booking.refundAmount),
    platformRetainedAmount: numberText(booking.platformRetainedAmount),
    actionNote: ""
  });

  useEffect(() => {
    setForm({
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      adminNote: booking.adminNote ?? "",
      cancelReason: booking.cancelReason ?? "",
      refundAmount: numberText(booking.refundAmount),
      platformRetainedAmount: numberText(booking.platformRetainedAmount),
      actionNote: ""
    });
  }, [booking]);

  const action = useMutation({
    mutationFn: () => adminApi.updateBookingAdmin(booking.id, {
      bookingStatus: form.bookingStatus,
      paymentStatus: form.paymentStatus,
      adminNote: form.adminNote || undefined,
      cancelReason: form.cancelReason || undefined,
      refundAmount: form.refundAmount === "" ? undefined : Number(form.refundAmount),
      platformRetainedAmount: form.platformRetainedAmount === "" ? undefined : Number(form.platformRetainedAmount),
      actionNote: form.actionNote || undefined
    }),
    onSuccess: async () => {
      toast.success("Đã cập nhật đơn đặt sân");
      await onUpdated();
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">{booking.bookingCode}</h2>
          <p className="text-sm text-slate-600">{booking.court.name} · {formatDate(booking.bookingDate)} · {formatTime(booking.startTime)} - {formatTime(booking.endTime)}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Info title="Khách hàng" lines={[booking.user?.fullName, booking.user?.email, booking.user?.phone]} />
          <Info title="Đối tác" lines={[booking.court.partner?.businessName, booking.court.partner?.user?.email, booking.court.partner?.user?.phone]} />
          <Info title="Địa điểm" lines={[booking.court.address, [booking.court.district, booking.court.city].filter(Boolean).join(", ")]} />
          <Info title="Ghi chú vận hành" lines={[booking.adminNote || "Chưa có ghi chú nội bộ", booking.cancelReason ? `Lý do hủy: ${booking.cancelReason}` : undefined]} />
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-4">
          <Metric label="Tổng tiền" value={formatMoney(booking.totalPrice)} strong />
          <Metric label="Đã đặt cọc" value={formatMoney(booking.depositAmount ?? 0)} />
          <Metric label="Hoàn tiền" value={formatMoney(booking.refundAmount ?? 0)} />
          <Metric label="Nền tảng giữ lại" value={formatMoney(booking.platformRetainedAmount ?? 0)} />
        </div>

        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left"><th className="p-3">Dịch vụ</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
            <tbody>
              {booking.bookingServices?.length ? booking.bookingServices.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">{item.service.name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.price)}</td>
                  <td>{formatMoney(item.price * item.quantity)}</td>
                </tr>
              )) : <tr className="border-t"><td className="p-3 text-slate-500" colSpan={4}>Không có dịch vụ kèm theo</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 xl:sticky xl:top-0 xl:self-start">
        <div className="rounded-lg border bg-slate-50 p-4">
          <h3 className="font-bold">Xử lý đơn</h3>
          <div className="mt-4 grid gap-2.5">
            <Select label="Trạng thái đơn" value={form.bookingStatus} onChange={(event) => setForm({ ...form, bookingStatus: event.target.value })} options={toOptions(bookingStatuses, bookingStatusLabels)} />
            <Select label="Trạng thái thanh toán" value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.target.value })} options={toOptions(paymentStatuses, paymentStatusLabels)} />
            <Input label="Số tiền hoàn" type="number" min="0" value={form.refundAmount} onChange={(event) => setForm({ ...form, refundAmount: event.target.value })} />
            <Input label="Nền tảng giữ lại" type="number" min="0" value={form.platformRetainedAmount} onChange={(event) => setForm({ ...form, platformRetainedAmount: event.target.value })} />
            <Input label="Lý do hủy / xử lý" value={form.cancelReason} onChange={(event) => setForm({ ...form, cancelReason: event.target.value })} />
            <Input label="Ghi chú nội bộ" value={form.adminNote} onChange={(event) => setForm({ ...form, adminNote: event.target.value })} />
            <Input label="Ghi chú cho lần thao tác này" value={form.actionNote} onChange={(event) => setForm({ ...form, actionNote: event.target.value })} />
            <Button disabled={action.isPending} onClick={() => action.mutate()}>Lưu xử lý</Button>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="font-bold">Lịch sử admin xử lý</h3>
          <div className="mt-3 max-h-52 space-y-3 overflow-y-auto pr-1 text-sm">
            {booking.adminActions?.length ? booking.adminActions.map((item) => (
              <div key={item.id} className="border-b pb-3 last:border-0 last:pb-0">
                <p className="font-semibold">{item.action}</p>
                <p className="text-slate-500">{new Date(item.createdAt).toLocaleString("vi-VN")} · {item.actor.fullName}</p>
                {item.note && <p className="mt-1">{item.note}</p>}
              </div>
            )) : <p className="text-slate-500">Chưa có lịch sử xử lý</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function updateFilter(setPage: (page: number) => void, setFilters: Dispatch<SetStateAction<Filters>>, key: keyof Filters, value: string) {
  setPage(1);
  setFilters((current) => ({ ...current, [key]: value }));
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (value: number) => void }) {
  return (
    <div className="flex justify-end gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
      <span className="py-2">{page}/{Math.max(total, 1)}</span>
      <Button variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)}>Sau</Button>
    </div>
  );
}

function StatusBadge({ value, labels }: { value: string; labels?: Record<string, string> }) {
  const tone = value.includes("CANCEL") || value.includes("REFUND") || value === "NO_SHOW"
    ? "bg-red-50 text-red-700"
    : value.includes("PAID") || value === "CONFIRMED" || value === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{labels?.[value] ?? value}</span>;
}

function Info({ title, lines }: { title: string; lines: Array<string | null | undefined> }) {
  const values = lines.filter(Boolean);
  return (
    <div className="rounded-lg border p-4">
      <p className="font-bold">{title}</p>
      {values.length ? values.map((line, index) => <p key={index} className="mt-1 text-sm text-slate-600">{line}</p>) : <p className="mt-1 text-sm text-slate-500">-</p>}
    </div>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-slate-500">{label}</p>
      <p className={`mt-1 text-lg ${strong ? "font-bold" : "font-semibold"}`}>{value}</p>
    </div>
  );
}

function withAll(values: string[], labels: Record<string, string>) {
  return [{ value: "", label: "Tất cả" }, ...toOptions(values, labels)];
}

function toOptions(values: string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

function formatMoney(value?: number | string | null) {
  return `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatTime(value?: string | Date | null) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}

function numberText(value?: string | number | null) {
  if (value === null || value === undefined) return "";
  return String(Number(value));
}
