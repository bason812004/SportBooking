import { useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ReceiptText, RefreshCcw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { SortableTh } from "../../components/common/SortableTh";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { useUrlSort } from "../../hooks/useUrlSort";
import { adminApi } from "../../features/admin/api/adminApi";
import type { AdminFinancePartner } from "../../types/api";

const currentMonth = new Date().toISOString().slice(0, 7);
const payoutStatuses = ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED"];
const payoutLabels: Record<string, string> = {
  PENDING: "Chờ chi trả",
  PROCESSING: "Đang xử lý",
  PAID: "Đã chi trả",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy"
};
const transactionLabels: Record<string, string> = {
  EARNING: "Ghi nhận doanh thu",
  REVERSAL: "Hoàn đảo"
};
const eventLabels: Record<string, string> = {
  COMPLETED: "Hoàn thành",
  NO_SHOW: "Không đến",
  REFUND: "Hoàn tiền"
};

type RecSortField = "businessName" | "transactionCount" | "grossAmount" | "commissionAmount" | "netAmount" | "refundAmount" | "payoutStatus" | "paidAt";
const REC_SORT_FIELDS: RecSortField[] = ["businessName", "transactionCount", "grossAmount", "commissionAmount", "netAmount", "refundAmount", "payoutStatus", "paidAt"];

function compareReconciliation(a: AdminFinancePartner, b: AdminFinancePartner, field: RecSortField, order: "asc" | "desc") {
  const direction = order === "asc" ? 1 : -1;
  let result = 0;
  if (field === "businessName" || field === "payoutStatus") {
    result = a[field].localeCompare(b[field]);
  } else if (field === "paidAt") {
    result = (a.paidAt ? new Date(a.paidAt).getTime() : 0) - (b.paidAt ? new Date(b.paidAt).getTime() : 0);
  } else {
    result = Number(a[field] ?? 0) - Number(b[field] ?? 0);
  }
  return result * direction;
}

type TxSortField = "bookingCode" | "transactionType" | "eventType" | "grossAmount" | "commissionAmount" | "netAmount" | "payoutStatus";
const TX_SORT_FIELDS: TxSortField[] = ["bookingCode", "transactionType", "eventType", "grossAmount", "commissionAmount", "netAmount", "payoutStatus"];

type RefundSortField = "bookingCode" | "customerName" | "totalPrice" | "refundAmount" | "platformRetainedAmount" | "paymentStatus";
const REFUND_SORT_FIELDS: RefundSortField[] = ["bookingCode", "customerName", "totalPrice", "refundAmount", "platformRetainedAmount", "paymentStatus"];

export function AdminFinancePage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<"reconciliation" | "transactions" | "refunds">("reconciliation");
  const [search, setSearch] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [refundPage, setRefundPage] = useState(1);

  const recSort = useUrlSort<RecSortField>({ fields: REC_SORT_FIELDS, default: null, paramPrefix: "rec" });
  const txSort = useUrlSort<TxSortField>({ fields: TX_SORT_FIELDS, default: null, paramPrefix: "tx" });
  const refundSort = useUrlSort<RefundSortField>({ fields: REFUND_SORT_FIELDS, default: null, paramPrefix: "refund" });
  const handleTxSort = (field: TxSortField) => { setTxPage(1); txSort.handleSort(field); };
  const handleRefundSort = (field: RefundSortField) => { setRefundPage(1); refundSort.handleSort(field); };

  const reconciliation = useQuery({
    queryKey: ["admin-finance-reconciliation", month],
    queryFn: () => adminApi.financeReconciliation(month)
  });
  const transactions = useQuery({
    queryKey: ["admin-finance-transactions", month, search, partnerId, txPage, txSort.sortField, txSort.sortOrder],
    queryFn: () => adminApi.financeTransactions({ month, search, partnerId, page: txPage, limit: 10, sortBy: txSort.sortField ?? undefined, sortOrder: txSort.sortOrder }),
    placeholderData: keepPreviousData
  });
  const refunds = useQuery({
    queryKey: ["admin-finance-refunds", month, search, partnerId, refundPage, refundSort.sortField, refundSort.sortOrder],
    queryFn: () => adminApi.financeRefunds({ month, search, partnerId, page: refundPage, limit: 10, sortBy: refundSort.sortField ?? undefined, sortOrder: refundSort.sortOrder }),
    placeholderData: keepPreviousData
  });

  const sortedPartners = useMemo(() => {
    const partners = reconciliation.data?.partners ?? [];
    if (!recSort.sortField) return partners;
    return [...partners].sort((a, b) => compareReconciliation(a, b, recSort.sortField as RecSortField, recSort.sortOrder));
  }, [reconciliation.data, recSort.sortField, recSort.sortOrder]);

  const payout = useMutation({
    mutationFn: ({ partner, status }: { partner: AdminFinancePartner; status: string }) =>
      adminApi.updatePayout(partner.partnerId, month, { status, note: partner.payoutNote ?? undefined }),
    onSuccess: async () => {
      toast.success("Đã cập nhật payout");
      await queryClient.invalidateQueries({ queryKey: ["admin-finance-reconciliation"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-finance-transactions"] });
    },
    onError: (error) => toast.error(error.message)
  });

  const exportReport = useMutation({
    mutationFn: () => adminApi.exportFinanceReport(month),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `finance-report-${month}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => toast.error(error.message)
  });

  if (reconciliation.isLoading) return <LoadingState />;
  if (reconciliation.isError) return <ErrorState message={reconciliation.error.message} />;

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Tài chính"
        title="Tài chính"
        subtitle="Theo dõi giao dịch, hoàn tiền, đối soát doanh thu partner và trạng thái payout."
        actions={
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white/95 p-2">
            <Input label="Tháng" type="month" value={month} onChange={(event) => { setTxPage(1); setRefundPage(1); setMonth(event.target.value); }} />
            <Button variant="secondary" disabled={exportReport.isPending} onClick={() => exportReport.mutate()}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      {reconciliation.data && (
        <div className="grid gap-3 md:grid-cols-4">
          <Summary label="Doanh thu ghi nhận" value={money(reconciliation.data.summary.grossAmount)} />
          <Summary label="Hoa hồng platform" value={money(reconciliation.data.summary.commissionAmount)} />
          <Summary label="Partner thực nhận" value={money(reconciliation.data.summary.netAmount)} />
          <Summary label="Đã hoàn tiền" value={money(reconciliation.data.summary.refundAmount)} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "reconciliation"} onClick={() => setTab("reconciliation")}>
          <WalletCards className="h-4 w-4" />
          Đối soát partner
        </TabButton>
        <TabButton active={tab === "transactions"} onClick={() => setTab("transactions")}>
          <ReceiptText className="h-4 w-4" />
          Giao dịch
        </TabButton>
        <TabButton active={tab === "refunds"} onClick={() => setTab("refunds")}>
          <RefreshCcw className="h-4 w-4" />
          Hoàn tiền
        </TabButton>
      </div>

      <div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2">
        <Input label="Tìm kiếm" value={search} onChange={(event) => { setTxPage(1); setRefundPage(1); setSearch(event.target.value); }} placeholder="Mã booking, sân, partner, khách hàng" />
        <Input label="ID partner" value={partnerId} onChange={(event) => { setTxPage(1); setRefundPage(1); setPartnerId(event.target.value); }} placeholder="pp0001" />
      </div>

      {tab === "reconciliation" && reconciliation.data && (
        <>
          <Table minWidth="1120px">
            <THead>
              <tr>
                <SortableTh label="Partner" field="businessName" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Giao dịch" field="transactionCount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Doanh thu" field="grossAmount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Hoa hồng" field="commissionAmount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Thực nhận" field="netAmount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Hoàn tiền" field="refundAmount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh label="Trạng thái payout" field="payoutStatus" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh label="Đã chi trả" field="paidAt" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
              </tr>
            </THead>
            <TBody>
              {sortedPartners.map((partner) => (
                <Tr key={partner.partnerId}>
                  <Td className="font-medium">{partner.businessName}<br /><span className="text-xs text-slate-500">{partner.partnerId}</span></Td>
                  <Td className="text-right">{partner.transactionCount}</Td>
                  <Td className="text-right">{money(partner.grossAmount)}</Td>
                  <Td className="text-right text-red-600">{money(partner.commissionAmount)}</Td>
                  <Td className="text-right font-semibold text-emerald-700">{money(partner.netAmount)}</Td>
                  <Td className="text-right">{money(partner.refundAmount)}<br /><span className="text-xs text-slate-500">{partner.refundCount} lượt</span></Td>
                  <Td>
                    <Select
                      value={partner.payoutStatus}
                      onChange={(event) => payout.mutate({ partner, status: event.target.value })}
                      options={payoutStatuses.map((status) => ({ value: status, label: payoutLabels[status] }))}
                    />
                  </Td>
                  <Td>{partner.paidAt ? new Date(partner.paidAt).toLocaleString("vi-VN") : "-"}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {!reconciliation.data.partners.length && <p className="p-6 text-center text-slate-500">Chưa có dữ liệu đối soát tháng này</p>}
        </>
      )}

      {tab === "transactions" && (
        <QueryTable loading={transactions.isLoading} error={transactions.error?.message}>
          <Table minWidth="1160px">
            <THead>
              <tr>
                <SortableTh label="Booking" field="bookingCode" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
                <Th>Partner / sân</Th>
                <SortableTh label="Loại" field="transactionType" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
                <SortableTh className="text-right" label="Doanh thu" field="grossAmount" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
                <SortableTh className="text-right" label="Hoa hồng" field="commissionAmount" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
                <SortableTh className="text-right" label="Thực nhận" field="netAmount" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
                <SortableTh label="Payout" field="payoutStatus" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
                <Th>Ngày ghi nhận</Th>
              </tr>
            </THead>
            <TBody>
              {transactions.data?.items.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.bookingCode}<br /><span className="text-xs text-slate-500">{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</span></Td>
                  <Td>{item.businessName}<br /><span className="text-xs text-slate-500">{item.courtName}</span></Td>
                  <Td>{transactionLabels[item.transactionType] ?? item.transactionType}<br /><span className="text-xs text-slate-500">{eventLabels[item.eventType] ?? item.eventType}</span></Td>
                  <Td className="text-right">{money(item.grossAmount)}</Td>
                  <Td className="text-right text-red-600">{money(item.commissionAmount)}<br /><span className="text-xs text-slate-500">{item.commissionRate}%</span></Td>
                  <Td className="text-right font-semibold text-emerald-700">{money(item.netAmount)}</Td>
                  <Td><Status value={item.payoutStatus} /></Td>
                  <Td>{new Date(item.createdAt).toLocaleString("vi-VN")}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </QueryTable>
      )}
      {tab === "transactions" && <Pager page={txPage} total={transactions.data?.meta.totalPages ?? 1} setPage={setTxPage} />}

      {tab === "refunds" && (
        <QueryTable loading={refunds.isLoading} error={refunds.error?.message}>
          <Table minWidth="1120px">
            <THead>
              <tr>
                <SortableTh label="Booking" field="bookingCode" sortField={refundSort.sortField} sortOrder={refundSort.sortOrder} onSort={handleRefundSort} />
                <SortableTh label="Khách hàng" field="customerName" sortField={refundSort.sortField} sortOrder={refundSort.sortOrder} onSort={handleRefundSort} />
                <Th>Partner / sân</Th>
                <SortableTh className="text-right" label="Tổng tiền" field="totalPrice" sortField={refundSort.sortField} sortOrder={refundSort.sortOrder} onSort={handleRefundSort} />
                <SortableTh className="text-right" label="Hoàn tiền" field="refundAmount" sortField={refundSort.sortField} sortOrder={refundSort.sortOrder} onSort={handleRefundSort} />
                <SortableTh className="text-right" label="Nền tảng giữ lại" field="platformRetainedAmount" sortField={refundSort.sortField} sortOrder={refundSort.sortOrder} onSort={handleRefundSort} />
                <SortableTh label="Trạng thái" field="paymentStatus" sortField={refundSort.sortField} sortOrder={refundSort.sortOrder} onSort={handleRefundSort} />
                <Th>Thời gian</Th>
              </tr>
            </THead>
            <TBody>
              {refunds.data?.items.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.bookingCode}<br /><span className="text-xs text-slate-500">{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</span></Td>
                  <Td>{item.user.fullName}<br /><span className="text-xs text-slate-500">{item.user.email}</span></Td>
                  <Td>{item.court.partner.businessName}<br /><span className="text-xs text-slate-500">{item.court.name}</span></Td>
                  <Td className="text-right">{money(item.totalPrice)}</Td>
                  <Td className="text-right text-red-600">{money(item.refundAmount)}</Td>
                  <Td className="text-right">{money(item.platformRetainedAmount)}</Td>
                  <Td>{item.paymentStatus}</Td>
                  <Td>{new Date(item.refundedAt).toLocaleString("vi-VN")}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </QueryTable>
      )}
      {tab === "refunds" && <Pager page={refundPage} total={refunds.data?.meta.totalPages ?? 1} setPage={setRefundPage} />}
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900 p-4 text-white">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold ${active ? "border-action bg-action text-white" : "border-line bg-white text-ink"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function QueryTable({ loading, error, children }: { loading: boolean; error?: string; children: ReactNode }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  return <>{children}</>;
}

function Status({ value }: { value: string }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{payoutLabels[value] ?? value}</span>;
}

function money(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;
}
