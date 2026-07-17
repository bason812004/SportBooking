import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { adminApi } from "../../features/admin/api/adminApi";
import { SettlementStatusBadge } from "./StatusBadges";
import type { Settlement } from "../../types/api";

const money = (value: number | string | null | undefined) => `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ quyết toán" },
  { value: "SETTLED", label: "Đã quyết toán" },
  { value: "CANCELLED", label: "Đã hủy" }
];

export function AdminSettlementsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{ action: "settle" | "cancel"; settlement: Settlement } | null>(null);

  const summary = useQuery({ queryKey: ["admin-settlements-summary"], queryFn: () => adminApi.settlementsSummary() });
  const settlements = useQuery({
    queryKey: ["admin-settlements", status, page],
    queryFn: () => adminApi.settlements({ status: status || undefined, page, limit: 10 }),
    placeholderData: keepPreviousData
  });

  const act = useMutation({
    mutationFn: ({ action, settlement }: { action: "settle" | "cancel"; settlement: Settlement }) =>
      action === "settle" ? adminApi.settleSettlement(settlement.id) : adminApi.cancelSettlement(settlement.id),
    onSuccess: async (_data, variables) => {
      toast.success(variables.action === "settle" ? "Đã quyết toán" : "Đã hủy settlement");
      setConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-settlements"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-settlements-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (summary.isLoading) return <LoadingState />;
  if (summary.isError) return <ErrorState message={summary.error.message} />;

  const total = summary.data!.total;
  const pending = summary.data!.byStatus.PENDING;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Quyết toán doanh thu</h1>
          <p className="text-sm text-slate-600">Theo dõi quyết toán từng booking đã thanh toán online và số tiền partner thực nhận.</p>
        </div>
        <Select label="Trạng thái" value={status} options={statusOptions} onChange={(event) => { setPage(1); setStatus(event.target.value); }} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Summary label="Tổng doanh thu gốc" value={money(total.grossAmount)} />
        <Summary label="Tổng hoa hồng" value={money(total.commissionAmount)} />
        <Summary label="Partner thực nhận" value={money(total.netAmount)} />
        <Summary label="Chờ quyết toán" value={`${pending?.count ?? 0} đơn · ${money(pending?.netAmount ?? 0)}`} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        {settlements.isLoading ? (
          <LoadingState />
        ) : settlements.isError ? (
          <ErrorState message={settlements.error.message} />
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <THead>
                  <tr>
                    <Th>Mã booking</Th>
                    <Th>Partner</Th>
                    <Th>Ngày tạo</Th>
                    <Th className="text-right">Doanh thu gốc</Th>
                    <Th className="text-right">Hoa hồng</Th>
                    <Th className="text-right">Thực nhận</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </THead>
                <TBody>
                  {(settlements.data?.items ?? []).map((item) => (
                    <Tr key={item.id}>
                      <Td className="font-medium">{item.booking?.bookingCode ?? item.bookingId}</Td>
                      <Td>{item.partner?.businessName ?? item.partnerId}</Td>
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
                            <Button variant="secondary" onClick={() => setConfirm({ action: "settle", settlement: item })}>Quyết toán</Button>
                            <Button variant="danger" onClick={() => setConfirm({ action: "cancel", settlement: item })}>Hủy</Button>
                          </div>
                        ) : item.status === "SETTLED" ? (
                          <Button variant="danger" onClick={() => setConfirm({ action: "cancel", settlement: item })}>Thu hồi</Button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                  {(settlements.data?.items ?? []).length === 0 && (
                    <tr>
                      <Td className="p-8 text-center text-slate-500" colSpan={8}>Không có settlement nào.</Td>
                    </tr>
                  )}
                </TBody>
              </table>
            </div>
            <div className="border-t border-line p-4">
              <Pager page={page} total={settlements.data?.meta.totalPages ?? 1} setPage={setPage} />
            </div>
          </>
        )}
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-xl font-bold">
              {confirm.action === "settle" ? "Quyết toán settlement?" : "Hủy / thu hồi settlement?"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Booking <b>{confirm.settlement.booking?.bookingCode ?? confirm.settlement.bookingId}</b> — partner nhận{" "}
              <b>{money(confirm.settlement.netAmount)}</b>.{" "}
              {confirm.action === "settle"
                ? "Tiền sẽ chuyển từ chờ quyết toán sang số dư khả dụng của partner."
                : confirm.settlement.status === "SETTLED"
                  ? "Tiền sẽ bị trừ khỏi số dư khả dụng của partner (thất bại nếu partner đã rút)."
                  : "Khoản chờ quyết toán sẽ bị thu hồi."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Đóng</Button>
              <Button
                variant={confirm.action === "settle" ? "primary" : "danger"}
                disabled={act.isPending}
                onClick={() => act.mutate(confirm)}
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900 p-4 text-white">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
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
