import { useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { adminApi } from "../../features/admin/api/adminApi";
import type { AdminBooking } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { BookingBillSummary } from "../../components/booking/BookingBillSummary";
import { ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { PeriodRangeFilter } from "../../components/common/PeriodRangeFilter";
import { SortableTh } from "../../components/common/SortableTh";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { TablePagination } from "../../components/common/TablePagination";
import { useDebounce } from "../../hooks/useDebounce";
import { useUrlSort } from "../../hooks/useUrlSort";
import { usePeriodRange } from "../../hooks/usePeriodRange";
import { bookingStatusLabel, courtArea, formatCurrency, paymentStatusLabel } from "../../lib/format";
import { bookingStatusTones, paymentStatusTones } from "../../lib/statusTones";

// Every status the database can hold, so any booking can be filtered and labelled.
const bookingStatuses = ["PENDING", "PENDING_PAYMENT", "CONFIRMED", "DEPOSIT_PAID", "IN_PROGRESS", "CHECKOUT_PENDING", "COMPLETED", "CANCELLED", "REJECTED", "EXPIRED", "NO_SHOW"];
const paymentStatuses = ["UNPAID", "PENDING", "PROCESSING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "PARTIALLY_REFUNDED", "REFUNDED"];

// Mirrors backend admin.bookingUpdate.ts, which enforces these; the form only offers the allowed moves.
const adminBookingStatusTargets = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const finalBookingStatuses = ["COMPLETED", "CANCELLED", "NO_SHOW", "REJECTED", "EXPIRED"];
const adminPaymentStatusTargets = ["UNPAID", "PAID", "PARTIALLY_REFUNDED", "REFUNDED"];

const bookingStatusLabels = Object.fromEntries(bookingStatuses.map((value) => [value, bookingStatusLabel(value)]));
const paymentStatusLabels = Object.fromEntries(paymentStatuses.map((value) => [value, paymentStatusLabel(value)]));

type Filters = {
  search: string;
  courtId: string;
  partnerId: string;
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

const defaultFilters: Filters = {
  search: "",
  courtId: "",
  partnerId: "",
  paymentStatus: "",
  bookingStatus: ""
};

type SortField = "bookingCode" | "customerName" | "bookingDate" | "totalPrice" | "bookingStatus" | "paymentStatus";

const SORT_FIELDS: SortField[] = ["bookingCode", "customerName", "bookingDate", "totalPrice", "bookingStatus", "paymentStatus"];

export function AdminBookingsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  // ?bookingId= (from a refund notification) opens that booking whatever the list filters are.
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(() => searchParams.get("bookingId"));
  useEffect(() => {
    const bookingId = searchParams.get("bookingId");
    if (bookingId) setSelected(bookingId);
  }, [searchParams]);
  const closeDetail = () => {
    setSelected(null);
    if (!searchParams.has("bookingId")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("bookingId");
    setSearchParams(next, { replace: true });
  };
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  // The search box only queries once the admin pauses typing.
  const search = useDebounce(filters.search, 300);
  const queryFilters = { ...filters, search };
  const period = usePeriodRange({ defaultMode: "day", onChange: () => setPage(1) });

  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({
    fields: SORT_FIELDS,
    default: { field: "bookingDate", order: "desc" }
  });
  const handleSort = (field: SortField) => {
    setPage(1);
    sortBy(field);
  };

  const list = useQuery({
    queryKey: ["admin-bookings", page, limit, queryFilters, period.range, sortField, sortOrder],
    queryFn: () =>
      adminApi.bookings({
        page,
        limit,
        ...queryFilters,
        fromDate: period.range.fromDate,
        toDate: period.range.toDate,
        sortBy: sortField ?? undefined,
        sortOrder
      }),
    placeholderData: keepPreviousData
  });
  const filterOptions = useQuery({
    queryKey: ["admin-booking-filter-options"],
    queryFn: adminApi.bookingFilterOptions,
    staleTime: 5 * 60_000
  });
  const detail = useQuery({
    queryKey: ["admin-booking", selected],
    queryFn: () => adminApi.bookingDetail(selected!),
    enabled: Boolean(selected)
  });

  // A save (e.g. a status the current filter excludes) can shrink the list under the current page.
  const totalPages = list.data?.meta.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (list.isLoading) return <LoadingState />;
  if (list.isError) return <ErrorState message={list.error.message} />;

  const partnerOptions = [
    { value: "", label: "Tất cả đối tác" },
    ...(filterOptions.data?.partners ?? []).map((partner) => ({ value: partner.id, label: partner.businessName }))
  ];
  const courtOptions = [
    { value: "", label: "Tất cả sân" },
    ...(filterOptions.data?.courts ?? [])
      .filter((court) => !filters.partnerId || court.partnerId === filters.partnerId)
      .map((court) => ({ value: court.id, label: court.name }))
  ];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Vận hành"
        title="Quản lý đơn đặt sân"
        subtitle="Theo dõi, lọc và xử lý booking toàn hệ thống."
        actions={
          <Button
            variant="secondary"
            onClick={() => { setPage(1); setFilters(defaultFilters); period.reset(); }}
          >
            Xóa lọc
          </Button>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <Input label="Tìm kiếm" value={filters.search} onChange={(event) => updateFilter(setPage, setFilters, "search", event.target.value)} placeholder="Mã đơn, khách (tên, email, SĐT), sân, đối tác" />
          <Select
            label="Đối tác"
            value={filters.partnerId}
            onChange={(event) => {
              setPage(1);
              // A court of another partner would make the list empty, so the court filter starts over.
              setFilters((current) => ({ ...current, partnerId: event.target.value, courtId: "" }));
            }}
            options={partnerOptions}
          />
          <Select label="Sân" value={filters.courtId} onChange={(event) => updateFilter(setPage, setFilters, "courtId", event.target.value)} options={courtOptions} />
          <Select label="Thanh toán" value={filters.paymentStatus} onChange={(event) => updateFilter(setPage, setFilters, "paymentStatus", event.target.value)} options={withAll(paymentStatuses, paymentStatusLabels)} />
          <Select label="Trạng thái đơn" value={filters.bookingStatus} onChange={(event) => updateFilter(setPage, setFilters, "bookingStatus", event.target.value)} options={withAll(bookingStatuses, bookingStatusLabels)} />
        </div>

        <div className="mt-4">
          <PeriodRangeFilter period={period} />
        </div>
      </div>

      <Table minWidth="980px">
        <THead>
          <tr>
            <SortableTh className="whitespace-nowrap" label="Mã đơn" field="bookingCode" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <SortableTh className="whitespace-nowrap" label="Khách hàng" field="customerName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <Th>Sân / đối tác</Th>
            <SortableTh className="whitespace-nowrap" label="Lịch đặt" field="bookingDate" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <SortableTh className="whitespace-nowrap text-right" label="Tổng hoá đơn" field="totalPrice" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <SortableTh className="whitespace-nowrap" label="Đơn" field="bookingStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <SortableTh className="whitespace-nowrap" label="Thanh toán" field="paymentStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <Th></Th>
          </tr>
        </THead>
        <TBody>
          {list.data?.items.map((booking) => (
            <Tr key={booking.id} className="align-top">
              <Td className="whitespace-nowrap font-bold">{booking.bookingCode}</Td>
              <Td className="whitespace-nowrap">{booking.user?.fullName}<br /><span className="text-xs text-slate-500">{booking.user?.email}</span></Td>
              <Td>{booking.court.name}<br /><span className="text-xs text-slate-500">{booking.court.partner?.businessName}</span></Td>
              <Td className="whitespace-nowrap">{formatDate(booking.bookingDate)}<br /><span className="text-xs text-slate-500">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span></Td>
              <Td className="whitespace-nowrap text-right">{formatCurrency(booking.billTotal ?? 0)}</Td>
              <Td className="whitespace-nowrap"><StatusBadge value={booking.bookingStatus} tones={bookingStatusTones} labels={bookingStatusLabels} /></Td>
              <Td className="whitespace-nowrap"><StatusBadge value={booking.paymentStatus} tones={paymentStatusTones} labels={paymentStatusLabels} /></Td>
              <Td className="text-right">
                <Button variant="secondary" onClick={() => setSelected(booking.id)}>
                  Chi tiết
                </Button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      {!list.data?.items.length && <p className="p-6 text-center text-slate-500">Không có đơn đặt sân phù hợp</p>}

      <TablePagination
        page={page}
        totalPages={list.data?.meta.totalPages ?? 1}
        total={list.data?.meta.total ?? 0}
        limit={limit}
        itemLabel="đơn"
        onPageChange={setPage}
        onLimitChange={(value) => {
          setPage(1);
          setLimit(value);
        }}
      />

      <BookingDetailModal open={Boolean(selected)} onClose={closeDetail}>
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

function formFor(booking: AdminBooking): BookingAdminForm {
  return {
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    adminNote: booking.adminNote ?? "",
    cancelReason: booking.cancelReason ?? "",
    refundAmount: numberText(booking.refundAmount),
    platformRetainedAmount: numberText(booking.platformRetainedAmount),
    actionNote: ""
  };
}

/** Only what the admin actually changed, so the current statuses are never resent as a change. */
function changedFields(booking: AdminBooking, form: BookingAdminForm) {
  const initial = formFor(booking);
  const changed = (key: keyof BookingAdminForm) => form[key] !== initial[key];
  return {
    bookingStatus: changed("bookingStatus") ? form.bookingStatus : undefined,
    paymentStatus: changed("paymentStatus") ? form.paymentStatus : undefined,
    adminNote: changed("adminNote") ? form.adminNote : undefined,
    cancelReason: changed("cancelReason") ? form.cancelReason : undefined,
    refundAmount: changed("refundAmount") && form.refundAmount !== "" ? Number(form.refundAmount) : undefined,
    platformRetainedAmount: changed("platformRetainedAmount") && form.platformRetainedAmount !== "" ? Number(form.platformRetainedAmount) : undefined
  };
}

function BookingDetail({ booking, onUpdated }: { booking: AdminBooking; onUpdated: () => Promise<void> }) {
  const [form, setForm] = useState<BookingAdminForm>(() => formFor(booking));

  useEffect(() => {
    setForm(formFor(booking));
  }, [booking]);

  const changes = changedFields(booking, form);
  const hasChanges = Object.values(changes).some((value) => value !== undefined);
  const statusLocked = finalBookingStatuses.includes(booking.bookingStatus);
  // The current status is always listed, even one an admin can't set, so the select shows the real value.
  const bookingStatusOptions = toOptions([booking.bookingStatus, ...adminBookingStatusTargets.filter((value) => value !== booking.bookingStatus)], bookingStatusLabels);
  const paymentStatusOptions = toOptions([booking.paymentStatus, ...adminPaymentStatusTargets.filter((value) => value !== booking.paymentStatus)], paymentStatusLabels);

  const action = useMutation({
    mutationFn: () => adminApi.updateBookingAdmin(booking.id, { ...changes, actionNote: form.actionNote || undefined }),
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
          <Info title="Địa điểm" lines={[booking.court.address, courtArea(booking.court)]} />
          <Info title="Ghi chú vận hành" lines={[booking.adminNote || "Chưa có ghi chú nội bộ", booking.cancelReason ? `Lý do hủy: ${booking.cancelReason}` : undefined]} />
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <p className="mb-2 font-bold">Hoá đơn</p>
            {booking.bill ? <BookingBillSummary bill={booking.bill} /> : null}
          </div>
          <div className="grid content-start gap-3 text-sm">
            <Metric label="Đã hoàn tiền" value={formatCurrency(booking.refundAmount ?? 0)} />
            <Metric label="Nền tảng giữ lại" value={formatCurrency(booking.platformRetainedAmount ?? 0)} />
          </div>
        </div>
      </section>

      <section className="space-y-4 xl:sticky xl:top-16 xl:self-start">
        <div className="rounded-lg border bg-slate-50 p-4">
          <h3 className="font-bold">Xử lý đơn</h3>
          <div className="mt-4 grid gap-2.5">
            <Select label="Trạng thái đơn" value={form.bookingStatus} disabled={statusLocked} onChange={(event) => setForm({ ...form, bookingStatus: event.target.value })} options={bookingStatusOptions} />
            {statusLocked && (
              <p className="text-xs text-slate-500">Đơn đã kết thúc nên không đổi được trạng thái. Khi hoàn tiền, hãy cập nhật trạng thái thanh toán và số tiền hoàn.</p>
            )}
            <Select label="Trạng thái thanh toán" value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.target.value })} options={paymentStatusOptions} />
            <Input label="Số tiền hoàn" type="number" min="0" value={form.refundAmount} onChange={(event) => setForm({ ...form, refundAmount: event.target.value })} />
            <Input label="Nền tảng giữ lại" type="number" min="0" value={form.platformRetainedAmount} onChange={(event) => setForm({ ...form, platformRetainedAmount: event.target.value })} />
            <Input label="Lý do hủy / xử lý" value={form.cancelReason} onChange={(event) => setForm({ ...form, cancelReason: event.target.value })} />
            <Input label="Ghi chú nội bộ" value={form.adminNote} onChange={(event) => setForm({ ...form, adminNote: event.target.value })} />
            <Input label="Ghi chú cho lần thao tác này" value={form.actionNote} onChange={(event) => setForm({ ...form, actionNote: event.target.value })} />
            <Button disabled={action.isPending || !hasChanges} onClick={() => action.mutate()}>Lưu xử lý</Button>
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

function Info({ title, lines }: { title: string; lines: Array<string | null | undefined> }) {
  const values = lines.filter(Boolean);
  return (
    <div className="rounded-lg border p-4">
      <p className="font-bold">{title}</p>
      {values.length ? values.map((line, index) => <p key={`${line}-${index}`} className="mt-1 text-sm text-slate-600">{line}</p>) : <p className="mt-1 text-sm text-slate-500">-</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function withAll(values: string[], labels: Record<string, string>) {
  return [{ value: "", label: "Tất cả" }, ...toOptions(values, labels)];
}

function toOptions(values: string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
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
