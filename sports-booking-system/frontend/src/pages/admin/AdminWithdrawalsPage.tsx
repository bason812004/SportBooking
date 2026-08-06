import { useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Landmark,
  Loader2,
  Send,
  Wallet,
  XCircle
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { SortableTh } from "../../components/common/SortableTh";
import { THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { useUrlSort } from "../../hooks/useUrlSort";
import { adminApi } from "../../features/admin/api/adminApi";
import { AdminReasonModal } from "./AdminReasonModal";
import { WithdrawalStatusBadge } from "./StatusBadges";
import type { WithdrawalRequest } from "../../types/api";

const money = (value: number | string | null | undefined) => `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const firstDayOfMonth = () => {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
};
const lastDayOfMonth = () => {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
};

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "PROCESSING", label: "Đang chuyển khoản" },
  { value: "REJECTED", label: "Từ chối" },
  { value: "FAILED", label: "Chuyển khoản thất bại" },
  { value: "PAID", label: "Đã chuyển khoản" }
];

type SortField = "createdAt" | "amount" | "status" | "partnerName";
const SORT_FIELDS: SortField[] = ["createdAt", "amount", "status", "partnerName"];

export function AdminWithdrawalsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(lastDayOfMonth);
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<WithdrawalRequest | null>(null);
  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({
    fields: SORT_FIELDS,
    default: { field: "createdAt", order: "desc" }
  });
  const handleSort = (field: SortField) => { setPage(1); sortBy(field); };

  const summary = useQuery({ queryKey: ["admin-withdrawals-summary"], queryFn: () => adminApi.withdrawalsSummary() });
  const withdrawals = useQuery({
    queryKey: ["admin-withdrawals", status, fromDate, toDate, page, sortField, sortOrder],
    queryFn: () =>
      adminApi.withdrawals({
        status: status || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: 10,
        sortBy: sortField ?? undefined,
        sortOrder
      }),
    placeholderData: keepPreviousData
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-withdrawals-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
  };

  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveWithdrawal(id),
    onSuccess: async () => { toast.success("Đã duyệt yêu cầu"); await refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => adminApi.rejectWithdrawal(id, note || undefined),
    onSuccess: async () => { toast.success("Đã từ chối và hoàn tiền vào ví"); setRejecting(null); await refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const pay = useMutation({
    mutationFn: (id: string) => adminApi.payWithdrawal(id),
    onSuccess: async () => { toast.success("Đã xác nhận chuyển khoản"); await refresh(); },
    onError: (error) => toast.error(error.message)
  });

  if (summary.isLoading) return <LoadingState />;
  if (summary.isError) return <ErrorState message={summary.error.message} />;

  const data = summary.data!;
  const pending = data.byStatus.PENDING;
  const processing = data.byStatus.PROCESSING;
  const paid = data.byStatus.PAID;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Tài chính"
        title="Yêu cầu rút tiền"
        subtitle="Duyệt và xác nhận chuyển khoản cho yêu cầu rút tiền của partner."
      >
        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-3 shadow-md">
          <Input label="Từ ngày" type="date" value={fromDate} onChange={(event) => { setPage(1); setFromDate(event.target.value); }} />
          <Input label="Đến ngày" type="date" value={toDate} onChange={(event) => { setPage(1); setToDate(event.target.value); }} />
          <Select label="Trạng thái" value={status} options={statusOptions} onChange={(event) => { setPage(1); setStatus(event.target.value); }} />
        </div>
      </PageHero>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Tổng yêu cầu" count={data.total.count} amount={data.total.amount} />
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Chờ duyệt" count={pending?.count ?? 0} amount={pending?.amount ?? 0} tone="text-amber-600" iconTone="bg-amber-100 text-amber-700" />
        <StatCard icon={<Loader2 className="h-5 w-5" />} label="Đang chuyển khoản" count={processing?.count ?? 0} amount={processing?.amount ?? 0} tone="text-violet-600" iconTone="bg-violet-100 text-violet-700" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Đã chuyển khoản" count={paid?.count ?? 0} amount={paid?.amount ?? 0} tone="text-emerald-700" iconTone="bg-emerald-100 text-emerald-700" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {withdrawals.isLoading ? (
          <LoadingState />
        ) : withdrawals.isError ? (
          <ErrorState message={withdrawals.error.message} />
        ) : (withdrawals.data?.items ?? []).length === 0 ? (
          <div className="p-6">
            <EmptyState title="Không có yêu cầu rút tiền nào" description="Các yêu cầu rút tiền của partner sẽ xuất hiện ở đây." />
          </div>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <THead>
                  <tr>
                    <SortableTh label="Ngày tạo" field="createdAt" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableTh label="Partner" field="partnerName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableTh label="Số tiền" field="amount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="text-right" />
                    <Th>Ngân hàng</Th>
                    <SortableTh label="Trạng thái" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <Th>Người xử lý</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </THead>
                <TBody>
                  {(withdrawals.data?.items ?? []).map((item) => (
                    <Tr key={item.id}>
                      <Td className="whitespace-nowrap text-slate-500">{new Date(item.createdAt).toLocaleString("vi-VN")}</Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                            {(item.partner?.businessName ?? "?").trim().charAt(0).toUpperCase()}
                          </span>
                          <span className="font-semibold text-slate-800">{item.partner?.businessName ?? item.partnerId}</span>
                        </div>
                      </Td>
                      <Td className="text-right font-black text-slate-900">{money(item.amount)}</Td>
                      <Td>
                        <div className="flex items-start gap-1.5 text-xs">
                          <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <div>
                            <p className="font-semibold text-slate-700">{item.bankName ?? "—"}</p>
                            <p className="font-mono text-slate-500">{item.bankAccountNumber ?? "—"}</p>
                            <p className="text-slate-400">{item.bankAccountName ?? "—"}</p>
                          </div>
                        </div>
                      </Td>
                      <Td><WithdrawalStatusBadge status={item.status} /></Td>
                      <Td className="text-slate-500">{item.processor?.fullName ?? "—"}</Td>
                      <Td className="text-right">
                        {item.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <Button disabled={approve.isPending} onClick={() => approve.mutate(item.id)}>
                              <CheckCircle2 className="h-4 w-4" />
                              Duyệt
                            </Button>
                            <Button variant="danger" onClick={() => setRejecting(item)}>
                              <XCircle className="h-4 w-4" />
                              Từ chối
                            </Button>
                          </div>
                        ) : item.status === "APPROVED" ? (
                          <div className="flex justify-end gap-2">
                            <Button disabled={pay.isPending} onClick={() => pay.mutate(item.id)}>
                              <Send className="h-4 w-4" />
                              Đã chuyển khoản
                            </Button>
                            <Button variant="danger" onClick={() => setRejecting(item)}>
                              <XCircle className="h-4 w-4" />
                              Từ chối
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </table>
            </div>
            <div className="border-t border-line p-4">
              <Pager page={page} total={withdrawals.data?.meta.totalPages ?? 1} setPage={setPage} />
            </div>
          </>
        )}
      </section>

      <AdminReasonModal
        open={rejecting !== null}
        title={`Từ chối yêu cầu rút ${money(rejecting?.amount)}?`}
        required
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => rejecting && reject.mutate({ id: rejecting.id, note: reason })}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  count,
  amount,
  tone = "text-slate-900",
  iconTone = "bg-slate-100 text-slate-600"
}: {
  icon: ReactNode;
  label: string;
  count: number;
  amount: number;
  tone?: string;
  iconTone?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconTone}`}>{icon}</span>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
      </div>
      <p className={`mt-3 text-2xl font-black ${tone}`}>{money(amount)}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-400">{count} yêu cầu</p>
    </div>
  );
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (value: number) => void }) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
        Trước
      </Button>
      <span className="text-sm font-semibold text-slate-500">
        Trang {page}/{Math.max(total, 1)}
      </span>
      <Button variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)}>
        Sau
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
