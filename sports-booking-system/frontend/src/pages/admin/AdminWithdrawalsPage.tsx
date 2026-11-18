import { useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Landmark,
  Send,
  Wallet,
  XCircle
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { Button } from "../../components/ui/Button";
import { DatePicker } from "../../components/ui/DatePicker";
import { Select } from "../../components/ui/Select";
import { SortableTh } from "../../components/common/SortableTh";
import { THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { TablePagination } from "../../components/common/TablePagination";
import { useUrlSort } from "../../hooks/useUrlSort";
import { adminApi } from "../../features/admin/api/adminApi";
import { localDateKey } from "../../lib/format";
import { ReasonModal } from "../../components/common/ReasonModal";
import { WithdrawalStatusBadge } from "./StatusBadges";
import type { WithdrawalRequest } from "../../types/api";

const money = (value: number | string | null | undefined) => `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;

const firstDayOfMonth = () => {
  const now = new Date();
  return localDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
};
const lastDayOfMonth = () => {
  const now = new Date();
  return localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
};

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "PROCESSING", label: "Đang chuyển khoản" },
  { value: "REJECTED", label: "Từ chối" },
  { value: "FAILED", label: "Chuyển khoản thất bại" },
  { value: "PAID", label: "Đã chuyển khoản" },
  { value: "CANCELLED", label: "Đối tác đã huỷ" }
];

type SortField = "createdAt" | "amount" | "status" | "partnerName";
const SORT_FIELDS: SortField[] = ["createdAt", "amount", "status", "partnerName"];

const commissionDebt = (item: WithdrawalRequest) => Number(item.partner?.wallet?.commissionDebt ?? 0);

/** The partner set or changed the payout account within 7 days before this request: worth a closer look. */
const RECENT_BANK_CHANGE_MS = 7 * 24 * 60 * 60 * 1000;
function bankChangedRecently(item: WithdrawalRequest) {
  const changedAt = item.partner?.bankAccountChangedAt ? new Date(item.partner.bankAccountChangedAt).getTime() : null;
  if (changedAt === null) return null;
  const gap = new Date(item.createdAt).getTime() - changedAt;
  return gap >= 0 && gap < RECENT_BANK_CHANGE_MS ? new Date(changedAt) : null;
}

export function AdminWithdrawalsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(lastDayOfMonth);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [approving, setApproving] = useState<WithdrawalRequest | null>(null);
  const [paying, setPaying] = useState<WithdrawalRequest | null>(null);
  const [rejecting, setRejecting] = useState<WithdrawalRequest | null>(null);
  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({
    fields: SORT_FIELDS,
    default: { field: "createdAt", order: "desc" }
  });
  const handleSort = (field: SortField) => { setPage(1); sortBy(field); };

  const summary = useQuery({ queryKey: ["admin-withdrawals-summary"], queryFn: () => adminApi.withdrawalsSummary() });
  const withdrawals = useQuery({
    queryKey: ["admin-withdrawals", status, fromDate, toDate, page, limit, sortField, sortOrder],
    queryFn: () =>
      adminApi.withdrawals({
        status: status || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit,
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
    onSuccess: async () => { toast.success("Đã duyệt yêu cầu, chờ chuyển khoản"); setApproving(null); await refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => adminApi.rejectWithdrawal(id, note),
    onSuccess: async () => { toast.success("Đã từ chối và hoàn tiền vào ví"); setRejecting(null); await refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const pay = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => adminApi.payWithdrawal(id, note),
    onSuccess: async () => { toast.success("Đã xác nhận chuyển khoản"); setPaying(null); await refresh(); },
    onError: (error) => toast.error(error.message)
  });

  const byStatus = summary.data?.byStatus;
  const pending = byStatus?.PENDING;
  // Approved requests wait for the admin's bank transfer; PROCESSING ones for the payout provider's (when one is on).
  const awaitingTransfer = {
    count: (byStatus?.APPROVED?.count ?? 0) + (byStatus?.PROCESSING?.count ?? 0),
    amount: (byStatus?.APPROVED?.amount ?? 0) + (byStatus?.PROCESSING?.amount ?? 0)
  };
  const paid = byStatus?.PAID;
  const items = withdrawals.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Tài chính"
        title="Yêu cầu rút tiền"
        subtitle="Duyệt yêu cầu, chuyển khoản cho đối tác từ tài khoản ngân hàng của nền tảng, rồi bấm “Đã chuyển khoản” và nhập mã giao dịch để hoàn tất."
      >
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-3 shadow-sm">
          <DatePicker label="Từ ngày" value={fromDate} onChange={(value) => { setPage(1); setFromDate(value); }} />
          <DatePicker label="Đến ngày" value={toDate} onChange={(value) => { setPage(1); setToDate(value); }} />
          <Select label="Trạng thái" value={status} options={statusOptions} onChange={(event) => { setPage(1); setStatus(event.target.value); }} />
        </div>
      </PageHero>

      {summary.isError ? (
        <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Toàn bộ yêu cầu (không theo bộ lọc ngày)</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<Clock3 className="h-5 w-5" />} label="Chờ duyệt" stat={summary.data && (pending ?? EMPTY)} tone="text-amber-600" iconTone="bg-amber-100 text-amber-700" />
            <StatCard icon={<Send className="h-5 w-5" />} label="Chờ chuyển khoản" stat={summary.data && awaitingTransfer} tone="text-sky-700" iconTone="bg-sky-100 text-sky-700" />
            <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Đã chuyển khoản" stat={summary.data && (paid ?? EMPTY)} tone="text-emerald-700" iconTone="bg-emerald-100 text-emerald-700" />
            <StatCard icon={<Wallet className="h-5 w-5" />} label="Tổng yêu cầu" stat={summary.data?.total} />
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {withdrawals.isLoading ? (
          <LoadingState />
        ) : withdrawals.isError ? (
          <div className="p-4"><ErrorState message={withdrawals.error.message} onRetry={() => withdrawals.refetch()} /></div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Không có yêu cầu rút tiền nào" description="Các yêu cầu rút tiền của đối tác trong khoảng ngày đã chọn sẽ xuất hiện ở đây." />
          </div>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <THead>
                  <tr>
                    <SortableTh label="Ngày tạo" field="createdAt" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableTh label="Đối tác" field="partnerName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableTh label="Số tiền" field="amount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="text-right" />
                    <Th>Ngân hàng</Th>
                    <SortableTh label="Trạng thái" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <Th>Người xử lý / ghi chú</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </THead>
                <TBody>
                  {items.map((item) => {
                    const debt = commissionDebt(item);
                    const open = item.status === "PENDING" || item.status === "APPROVED" || item.status === "PROCESSING";
                    return (
                      <Tr key={item.id}>
                        <Td className="whitespace-nowrap text-slate-500">{new Date(item.createdAt).toLocaleString("vi-VN")}</Td>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                              {(item.partner?.businessName ?? "?").trim().charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-800">{item.partner?.businessName ?? item.partnerId}</p>
                              {open && debt > 0 && (
                                <p className="flex items-center gap-1 text-xs font-semibold text-red-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  Nợ hoa hồng {money(debt)}
                                </p>
                              )}
                              {open && bankChangedRecently(item) && (
                                <p className="flex items-center gap-1 text-xs font-semibold text-amber-700" title="Đối tác đổi tài khoản nhận tiền không lâu trước yêu cầu này">
                                  <AlertTriangle className="h-3 w-3" />
                                  TK mới đổi {bankChangedRecently(item)!.toLocaleDateString("vi-VN")}
                                </p>
                              )}
                            </div>
                          </div>
                        </Td>
                        <Td className="text-right font-black text-slate-900">{money(item.amount)}</Td>
                        <Td>
                          <BankAccount item={item} />
                        </Td>
                        <Td><WithdrawalStatusBadge status={item.status} /></Td>
                        <Td className="max-w-56 text-slate-500">
                          {item.processor?.fullName ?? "—"}
                          {item.note && <p className="truncate text-xs text-slate-400" title={item.note}>{item.note}</p>}
                        </Td>
                        <Td className="text-right">
                          {item.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <Button onClick={() => setApproving(item)}>
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
                              <Button onClick={() => setPaying(item)}>
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
                    );
                  })}
                </TBody>
              </table>
            </div>
            <div className="border-t border-line p-4">
              <TablePagination
                page={page}
                totalPages={withdrawals.data?.meta.totalPages ?? 1}
                total={withdrawals.data?.meta.total ?? 0}
                limit={limit}
                itemLabel="yêu cầu"
                onPageChange={setPage}
                onLimitChange={(value) => { setPage(1); setLimit(value); }}
              />
            </div>
          </>
        )}
      </section>

      {approving && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-xl font-bold">Duyệt yêu cầu rút {money(approving.amount)}?</h2>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <p>
                Đối tác <b>{approving.partner?.businessName ?? approving.partnerId}</b>. Sau khi duyệt, hãy chuyển khoản tới tài khoản dưới đây rồi bấm
                “Đã chuyển khoản”.
              </p>
              <div className="rounded-xl bg-slate-50 p-3"><BankAccount item={approving} /></div>
              {bankChangedRecently(approving) && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  Đối tác vừa đổi tài khoản nhận tiền lúc <b>{bankChangedRecently(approving)!.toLocaleString("vi-VN")}</b>. Hãy liên hệ xác nhận với đối tác
                  trước khi chuyển khoản.
                </p>
              )}
              <p>Số dư khả dụng còn lại (đã trừ khoản đang rút): <b>{money(approving.partner?.wallet?.availableBalance)}</b></p>
              {commissionDebt(approving) > 0 && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                  Đối tác đang nợ hoa hồng <b>{money(commissionDebt(approving))}</b>. Nếu từ chối, số tiền đang rút được hoàn về ví và bù trừ vào khoản nợ
                  này trước.
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" disabled={approve.isPending} onClick={() => setApproving(null)}>Đóng</Button>
              <Button disabled={approve.isPending} onClick={() => approve.mutate(approving.id)}>
                {approve.isPending ? "Đang xử lý..." : "Duyệt"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ReasonModal
        key={`pay-${paying?.id ?? "none"}`}
        open={paying !== null}
        required
        title={`Xác nhận đã chuyển ${money(paying?.amount)}?`}
        description={
          paying && (
            <div className="space-y-2">
              <p>Chỉ xác nhận sau khi tiền đã rời tài khoản nền tảng. Bước này không hoàn tác được.</p>
              <div className="rounded-xl bg-slate-50 p-3"><BankAccount item={paying} /></div>
            </div>
          )
        }
        label="Mã giao dịch / nội dung chuyển khoản"
        placeholder="Ví dụ: FT26301123456 - SB rut tien WR..."
        confirmLabel="Đã chuyển khoản"
        confirmVariant="primary"
        pending={pay.isPending}
        onClose={() => setPaying(null)}
        onConfirm={(note) => paying && pay.mutate({ id: paying.id, note })}
      />

      <ReasonModal
        key={`reject-${rejecting?.id ?? "none"}`}
        open={rejecting !== null}
        required
        title={`Từ chối yêu cầu rút ${money(rejecting?.amount)}?`}
        description="Số tiền được hoàn về ví khả dụng của đối tác (bù trừ công nợ hoa hồng trước nếu có). Đối tác nhận thông báo kèm lý do."
        label="Lý do"
        placeholder="Ví dụ: thông tin tài khoản ngân hàng không khớp tên đối tác"
        pending={reject.isPending}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => rejecting && reject.mutate({ id: rejecting.id, note: reason })}
      />
    </div>
  );
}

const EMPTY = { count: 0, amount: 0 };

function BankAccount({ item }: { item: WithdrawalRequest }) {
  return (
    <div className="flex items-start gap-1.5 text-left text-xs">
      <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <div>
        <p className="font-semibold text-slate-700">{item.bankName ?? "—"}</p>
        <p className="font-mono text-slate-500">{item.bankAccountNumber ?? "—"}</p>
        <p className="text-slate-400">{item.bankAccountName ?? "—"}</p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  stat,
  tone = "text-slate-900",
  iconTone = "bg-slate-100 text-slate-600"
}: {
  icon: ReactNode;
  label: string;
  stat: { count: number; amount: number } | undefined;
  tone?: string;
  iconTone?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconTone}`}>{icon}</span>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
      </div>
      <p className={`mt-3 text-2xl font-black ${tone}`}>{stat ? money(stat.amount) : "—"}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-400">{stat ? `${stat.count} yêu cầu` : "Đang tải..."}</p>
    </div>
  );
}
