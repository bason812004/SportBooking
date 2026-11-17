import { useTranslation } from "react-i18next";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { TablePagination } from "../../components/common/TablePagination";
import { PageHero } from "../../components/common/PageHero";
import { useDebounce } from "../../hooks/useDebounce";
import { adminApi } from "../../features/admin/api/adminApi";
import { CommissionDebtPanel } from "../../features/admin/components/CommissionDebtPanel";
import { OverdueBookingsPanel } from "../../features/bookings/components/OverdueBookingsPanel";
import { bookingStatusBadge } from "../../lib/format";
import { ReasonModal } from "../../components/common/ReasonModal";
import { SettlementStatusBadge } from "./StatusBadges";
import type { Settlement } from "../../types/api";

const money = (value: number | string | null | undefined) => `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ quyết toán" },
  { value: "SETTLED", label: "Đã quyết toán" },
  { value: "CANCELLED", label: "Đã hủy" }
];

/** Online money is released by hand only once the booking is over: played, or the customer did not come. */
const SETTLEABLE_BOOKING_STATUSES = ["COMPLETED", "NO_SHOW"];

export function AdminSettlementsPage() {
  const { t } = useTranslation("booking");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [settling, setSettling] = useState<Settlement | null>(null);
  const [cancelling, setCancelling] = useState<Settlement | null>(null);

  // The summary counts every status (its cards break them down), so the status filter only narrows the list.
  const summaryFilters = { collectedBy, partnerId, search: debouncedSearch, fromDate, toDate };
  const filters = { ...summaryFilters, status };
  const filtered = Object.values(filters).some(Boolean);
  const summaryFiltered = Object.values(summaryFilters).some(Boolean);
  const changeFilter = (apply: () => void) => { setPage(1); apply(); };

  const filterOptions = useQuery({
    queryKey: ["admin-booking-filter-options"],
    queryFn: adminApi.bookingFilterOptions,
    staleTime: 5 * 60_000
  });
  const summary = useQuery({
    queryKey: ["admin-settlements-summary", summaryFilters],
    queryFn: () => adminApi.settlementsSummary(summaryFilters),
    placeholderData: keepPreviousData
  });
  // Bookings over but still open keep their online money waiting here until someone (or the system) finishes them.
  const overdue = useQuery({ queryKey: ["admin-overdue-bookings"], queryFn: adminApi.overdueBookings, refetchInterval: 5 * 60_000 });
  const settlements = useQuery({
    queryKey: ["admin-settlements", filters, page, limit],
    queryFn: () => adminApi.settlements({ ...filters, page, limit }),
    placeholderData: keepPreviousData
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-settlements"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-settlements-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
  };
  const settle = useMutation({
    mutationFn: (settlement: Settlement) => adminApi.settleSettlement(settlement.id),
    onSuccess: async () => {
      toast.success("Đã quyết toán");
      setSettling(null);
      await refresh();
    },
    onError: (error) => toast.error(error.message)
  });
  const cancel = useMutation({
    mutationFn: ({ settlement, reason }: { settlement: Settlement; reason: string }) => adminApi.cancelSettlement(settlement.id, reason),
    onSuccess: async (_data, variables) => {
      toast.success(variables.settlement.status === "SETTLED" ? "Đã thu hồi khoản quyết toán" : "Đã hủy khoản quyết toán");
      setCancelling(null);
      await refresh();
    },
    onError: (error) => toast.error(error.message)
  });

  // Cancelled settlements were never owed, so the totals leave them out.
  const cancelled = summary.data?.byStatus.CANCELLED;
  const total = summary.data && {
    grossAmount: summary.data.total.grossAmount - (cancelled?.grossAmount ?? 0),
    commissionAmount: summary.data.total.commissionAmount - (cancelled?.commissionAmount ?? 0),
    netAmount: summary.data.total.netAmount - (cancelled?.netAmount ?? 0)
  };
  const pending = summary.data?.byStatus.PENDING;
  const partnerOptions = [
    { value: "", label: "Tất cả đối tác" },
    ...(filterOptions.data?.partners ?? []).map((partner) => ({ value: partner.id, label: partner.businessName }))
  ];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Tài chính"
        title="Quyết toán doanh thu"
        subtitle={t("openTab.settlementDescription")}
      />

      <div className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
        <Input
          label="Mã booking / đối tác"
          value={search}
          placeholder="BK-..."
          onChange={(event) => changeFilter(() => setSearch(event.target.value))}
        />
        <Select label="Đối tác" value={partnerId} options={partnerOptions} onChange={(event) => changeFilter(() => setPartnerId(event.target.value))} />
        <Select
          label={t("openTab.collectionSource")}
          value={collectedBy}
          options={[
            { value: "", label: "Tất cả nguồn thu" },
            { value: "PLATFORM", label: t("openTab.platformCollected") },
            { value: "PARTNER", label: t("openTab.partnerCollected") }
          ]}
          onChange={(event) => changeFilter(() => setCollectedBy(event.target.value))}
        />
        <Select label="Trạng thái" value={status} options={statusOptions} onChange={(event) => changeFilter(() => setStatus(event.target.value))} />
        <Input label="Từ ngày" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => changeFilter(() => setFromDate(event.target.value))} />
        <Input label="Đến ngày" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => changeFilter(() => setToDate(event.target.value))} />
      </div>

      {summary.isError ? (
        <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {summaryFiltered ? "Theo bộ lọc (mọi trạng thái)" : "Toàn bộ"} · không tính khoản đã hủy
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Summary label="Tổng doanh thu gốc" value={total && money(total.grossAmount)} />
            <Summary label="Tổng hoa hồng" value={total && money(total.commissionAmount)} />
            <Summary label="Đối tác thực nhận" value={total && money(total.netAmount)} />
            <Summary label="Chờ quyết toán" value={summary.data && `${pending?.count ?? 0} đơn · ${money(pending?.netAmount ?? 0)}`} />
          </div>
        </div>
      )}

      <OverdueBookingsPanel bookings={overdue.data} />

      <CommissionDebtPanel />

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        {settlements.isLoading ? (
          <LoadingState />
        ) : settlements.isError ? (
          <div className="p-4"><ErrorState message={settlements.error.message} onRetry={() => settlements.refetch()} /></div>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <THead>
                  <tr>
                    <Th>Mã booking</Th>
                    <Th>Đối tác</Th>
                    <Th>{t("openTab.collectionSource")}</Th>
                    <Th>Trạng thái đơn</Th>
                    <Th>Ngày tạo</Th>
                    <Th className="text-right">Doanh thu gốc</Th>
                    <Th className="text-right">Hoa hồng</Th>
                    <Th className="text-right">Thực nhận</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </THead>
                <TBody>
                  {(settlements.data?.items ?? []).map((item) => {
                    const bookingStatus = item.booking?.bookingStatus ?? "";
                    const badge = bookingStatusBadge(bookingStatus);
                    const settleable = SETTLEABLE_BOOKING_STATUSES.includes(bookingStatus);
                    return (
                      <Tr key={item.id}>
                        <Td className="font-medium">
                          {item.booking?.bookingCode ?? item.bookingId}
                          {item.booking?.court && <><br /><span className="text-xs font-normal text-slate-500">{item.booking.court.name}</span></>}
                        </Td>
                        <Td>{item.partner?.businessName ?? item.partnerId}</Td>
                        <Td>{t(item.collectedBy === "PARTNER" ? "openTab.partnerCollected" : "openTab.platformCollected")}</Td>
                        <Td>
                          {bookingStatus ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.tone}`}>{badge.label}</span> : "—"}
                        </Td>
                        <Td>{new Date(item.createdAt).toLocaleString("vi-VN")}</Td>
                        <Td className="text-right">{money(item.grossAmount)}</Td>
                        <Td className="text-right text-red-600">
                          {money(item.commissionAmount)} ({item.commissionRate}%)
                        </Td>
                        <Td className="text-right font-semibold text-emerald-700">{money(item.netAmount)}</Td>
                        <Td><SettlementStatusBadge status={item.status} /></Td>
                        <Td className="text-right">
                          {item.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                disabled={!settleable}
                                title={settleable ? undefined : "Chỉ quyết toán được khi đơn đã hoàn tất hoặc khách không đến"}
                                onClick={() => setSettling(item)}
                              >
                                Quyết toán
                              </Button>
                              <Button variant="danger" onClick={() => setCancelling(item)}>Hủy</Button>
                            </div>
                          ) : item.status === "SETTLED" ? (
                            <Button variant="danger" onClick={() => setCancelling(item)}>Thu hồi</Button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                  {(settlements.data?.items ?? []).length === 0 && (
                    <tr>
                      <Td className="p-8 text-center text-slate-500" colSpan={10}>
                        {filtered ? "Không có khoản quyết toán phù hợp bộ lọc." : "Chưa có khoản quyết toán nào."}
                      </Td>
                    </tr>
                  )}
                </TBody>
              </table>
            </div>
            <div className="border-t border-line p-4">
              <TablePagination
                page={page}
                totalPages={settlements.data?.meta.totalPages ?? 1}
                total={settlements.data?.meta.total ?? 0}
                limit={limit}
                itemLabel="khoản"
                onPageChange={setPage}
                onLimitChange={(value) => { setPage(1); setLimit(value); }}
              />
            </div>
          </>
        )}
      </section>

      {settling && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-xl font-bold">Quyết toán khoản này?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Booking <b>{settling.booking?.bookingCode ?? settling.bookingId}</b> — đối tác nhận <b>{money(settling.netAmount)}</b>.{" "}
              Tiền chuyển từ chờ quyết toán sang số dư khả dụng của đối tác.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" disabled={settle.isPending} onClick={() => setSettling(null)}>Đóng</Button>
              <Button disabled={settle.isPending} onClick={() => settle.mutate(settling)}>
                {settle.isPending ? "Đang xử lý..." : "Xác nhận"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ReasonModal
        key={cancelling?.id ?? "none"}
        open={Boolean(cancelling)}
        required
        title={cancelling?.status === "SETTLED" ? "Thu hồi khoản đã quyết toán?" : "Hủy khoản quyết toán?"}
        description={
          cancelling && (
            <p>
              Booking <b>{cancelling.booking?.bookingCode ?? cancelling.bookingId}</b> — đối tác nhận <b>{money(cancelling.netAmount)}</b>.{" "}
              {cancelling.collectedBy === "PARTNER"
                ? t("openTab.counterCancellation")
                : cancelling.status === "SETTLED"
                  ? "Tiền bị trừ khỏi số dư khả dụng của đối tác (không thực hiện được nếu đối tác đã rút)."
                  : "Khoản chờ quyết toán bị thu hồi khỏi ví đối tác."}{" "}
              Đối tác nhận thông báo kèm lý do.
            </p>
          )
        }
        label="Lý do"
        placeholder="Ví dụ: đơn bị khiếu nại, khách đã được hoàn tiền ngoài hệ thống..."
        pending={cancel.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={(reason) => cancelling && cancel.mutate({ settlement: cancelling, reason })}
      />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg bg-slate-900 p-4 text-white">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value ?? "—"}</p>
    </div>
  );
}
