import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Banknote, Coins, Download, HandCoins, Landmark, ReceiptText, RefreshCcw, Scale, Send, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { SortableTh } from "../../components/common/SortableTh";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { TablePagination } from "../../components/common/TablePagination";
import { useDebounce } from "../../hooks/useDebounce";
import { useUrlSort } from "../../hooks/useUrlSort";
import { adminApi } from "../../features/admin/api/adminApi";
import { localMonthKey } from "../../lib/format";
import type { AdminFinancePartner } from "../../types/api";

const transactionLabels: Record<string, string> = {
  EARNING: "Ghi nhận doanh thu",
  ADJUSTMENT: "Điều chỉnh tăng",
  REVERSAL: "Hoàn đảo"
};
const eventLabels: Record<string, string> = {
  COMPLETED: "Hoàn thành",
  NO_SHOW: "Không đến",
  REFUND: "Hoàn tiền"
};
const paymentStatusLabels: Record<string, string> = {
  REFUNDED: "Đã hoàn tiền",
  PARTIALLY_REFUNDED: "Hoàn tiền một phần"
};
const paymentStatusTones: Record<string, string> = {
  REFUNDED: "bg-emerald-100 text-emerald-800",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-800"
};

type FinanceTotals = Omit<AdminFinancePartner, "partnerId" | "businessName">;
const TOTAL_FIELDS: Array<keyof FinanceTotals> = [
  "grossAmount",
  "commissionAmount",
  "netAmount",
  "transactionCount",
  "refundAmount",
  "platformRetainedAmount",
  "refundCount",
  "paidOutAmount",
  "paidOutCount",
  "walletPending",
  "walletAvailable",
  "commissionDebt"
];

function sumPartners(partners: AdminFinancePartner[]) {
  return Object.fromEntries(
    TOTAL_FIELDS.map((field) => [field, partners.reduce((sum, partner) => sum + Number(partner[field] ?? 0), 0)])
  ) as FinanceTotals;
}

type RecSortField =
  | "businessName"
  | "transactionCount"
  | "grossAmount"
  | "commissionAmount"
  | "netAmount"
  | "refundAmount"
  | "paidOutAmount"
  | "walletAvailable"
  | "commissionDebt";
const REC_SORT_FIELDS: RecSortField[] = [
  "businessName",
  "transactionCount",
  "grossAmount",
  "commissionAmount",
  "netAmount",
  "refundAmount",
  "paidOutAmount",
  "walletAvailable",
  "commissionDebt"
];

function compareReconciliation(a: AdminFinancePartner, b: AdminFinancePartner, field: RecSortField, order: "asc" | "desc") {
  const direction = order === "asc" ? 1 : -1;
  const result = field === "businessName" ? a.businessName.localeCompare(b.businessName) : Number(a[field] ?? 0) - Number(b[field] ?? 0);
  return result * direction;
}

type TxSortField = "bookingCode" | "transactionType" | "eventType" | "grossAmount" | "commissionAmount" | "netAmount";
const TX_SORT_FIELDS: TxSortField[] = ["bookingCode", "transactionType", "eventType", "grossAmount", "commissionAmount", "netAmount"];

type RefundSortField = "bookingCode" | "customerName" | "totalPrice" | "refundAmount" | "platformRetainedAmount" | "paymentStatus";
const REFUND_SORT_FIELDS: RefundSortField[] = ["bookingCode", "customerName", "totalPrice", "refundAmount", "platformRetainedAmount", "paymentStatus"];

export function AdminFinancePage() {
  const [month, setMonth] = useState(localMonthKey);
  const [tab, setTab] = useState<"reconciliation" | "transactions" | "refunds">("reconciliation");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [partnerId, setPartnerId] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [txLimit, setTxLimit] = useState(10);
  const [refundPage, setRefundPage] = useState(1);
  const [refundLimit, setRefundLimit] = useState(10);

  const recSort = useUrlSort<RecSortField>({ fields: REC_SORT_FIELDS, default: null, paramPrefix: "rec" });
  const txSort = useUrlSort<TxSortField>({ fields: TX_SORT_FIELDS, default: null, paramPrefix: "tx" });
  const refundSort = useUrlSort<RefundSortField>({ fields: REFUND_SORT_FIELDS, default: null, paramPrefix: "refund" });
  const handleTxSort = (field: TxSortField) => { setTxPage(1); txSort.handleSort(field); };
  const handleRefundSort = (field: RefundSortField) => { setRefundPage(1); refundSort.handleSort(field); };
  const resetPages = () => { setTxPage(1); setRefundPage(1); };

  const filterOptions = useQuery({
    queryKey: ["admin-booking-filter-options"],
    queryFn: adminApi.bookingFilterOptions,
    staleTime: 5 * 60_000
  });
  const reconciliation = useQuery({
    queryKey: ["admin-finance-reconciliation", month],
    queryFn: () => adminApi.financeReconciliation(month),
    placeholderData: keepPreviousData
  });
  const transactions = useQuery({
    queryKey: ["admin-finance-transactions", month, debouncedSearch, partnerId, txPage, txLimit, txSort.sortField, txSort.sortOrder],
    queryFn: () =>
      adminApi.financeTransactions({
        month,
        search: debouncedSearch,
        partnerId,
        page: txPage,
        limit: txLimit,
        sortBy: txSort.sortField ?? undefined,
        sortOrder: txSort.sortOrder
      }),
    placeholderData: keepPreviousData,
    enabled: tab === "transactions"
  });
  const refunds = useQuery({
    queryKey: ["admin-finance-refunds", month, debouncedSearch, partnerId, refundPage, refundLimit, refundSort.sortField, refundSort.sortOrder],
    queryFn: () =>
      adminApi.financeRefunds({
        month,
        search: debouncedSearch,
        partnerId,
        page: refundPage,
        limit: refundLimit,
        sortBy: refundSort.sortField ?? undefined,
        sortOrder: refundSort.sortOrder
      }),
    placeholderData: keepPreviousData,
    enabled: tab === "refunds"
  });

  // The reconciliation is one row per partner for the whole month, so the filters apply here in the browser.
  const filteredPartners = useMemo(() => {
    const needle = debouncedSearch.toLowerCase();
    return (reconciliation.data?.partners ?? []).filter(
      (partner) =>
        (!partnerId || partner.partnerId === partnerId) &&
        (!needle || partner.businessName.toLowerCase().includes(needle) || partner.partnerId.toLowerCase().includes(needle))
    );
  }, [reconciliation.data, partnerId, debouncedSearch]);
  const sortedPartners = useMemo(() => {
    if (!recSort.sortField) return filteredPartners;
    return [...filteredPartners].sort((a, b) => compareReconciliation(a, b, recSort.sortField as RecSortField, recSort.sortOrder));
  }, [filteredPartners, recSort.sortField, recSort.sortOrder]);
  const filtered = Boolean(partnerId || debouncedSearch);
  const totals = reconciliation.data ? (filtered ? sumPartners(filteredPartners) : reconciliation.data.summary) : null;

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

  const partnerOptions = [
    { value: "", label: "Tất cả đối tác" },
    ...(filterOptions.data?.partners ?? []).map((partner) => ({ value: partner.id, label: partner.businessName }))
  ];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Tài chính"
        title="Tài chính"
        subtitle="Đối soát doanh thu, hoa hồng, hoàn tiền và số dư ví của đối tác. Tiền trả cho đối tác đi qua tab Rút tiền."
        actions={
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white/95 p-2">
            <Input
              label="Tháng"
              type="month"
              value={month}
              onChange={(event) => {
                if (!event.target.value) return;
                resetPages();
                setMonth(event.target.value);
              }}
            />
            <Button variant="secondary" disabled={exportReport.isPending} onClick={() => exportReport.mutate()}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sổ hoa hồng tháng {month}{filtered ? " · theo bộ lọc" : ""}
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <Summary icon={ReceiptText} tone="slate" label="Doanh thu ghi nhận" value={totals && money(totals.grossAmount)} hint={totals && `${totals.transactionCount} đơn`} />
          <Summary icon={Coins} tone="rose" label="Hoa hồng nền tảng" value={totals && money(totals.commissionAmount)} />
          <Summary
            icon={HandCoins}
            tone="emerald"
            label="Đối tác thực nhận"
            value={totals && money(totals.netAmount)}
            hint="Gồm cả phần đối tác tự thu tại sân"
          />
          <Summary icon={Banknote} tone="amber" label="Đã hoàn tiền" value={totals && money(totals.refundAmount)} hint={totals && `${totals.refundCount} lượt`} />
        </div>
        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Ví đối tác</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Summary
            icon={Landmark}
            tone="blue"
            label="Nền tảng đang giữ (hiện tại)"
            value={totals && money(totals.walletPending + totals.walletAvailable)}
            hint={totals && `Chờ quyết toán ${money(totals.walletPending)} · khả dụng ${money(totals.walletAvailable)}`}
          />
          <Summary
            icon={Send}
            tone="emerald"
            label={`Đã chuyển khoản trong tháng ${month}`}
            value={totals && money(totals.paidOutAmount)}
            hint={totals && `${totals.paidOutCount} lệnh rút tiền đã trả`}
          />
          <Summary
            icon={Scale}
            tone="rose"
            label="Công nợ hoa hồng (hiện tại)"
            value={totals && money(totals.commissionDebt)}
            hint="Hoa hồng đối tác còn nợ trên tiền tự thu"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "reconciliation"} onClick={() => setTab("reconciliation")}>
          <WalletCards className="h-4 w-4" />
          Đối soát đối tác
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

      <div className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-2">
        <Input
          label="Tìm kiếm"
          value={search}
          onChange={(event) => { resetPages(); setSearch(event.target.value); }}
          placeholder={tab === "reconciliation" ? "Tên hoặc mã đối tác" : "Mã booking, sân, đối tác, khách hàng"}
        />
        <Select
          label="Đối tác"
          value={partnerId}
          onChange={(event) => { resetPages(); setPartnerId(event.target.value); }}
          options={partnerOptions}
        />
      </div>

      {tab === "reconciliation" && (
        <QueryTable loading={reconciliation.isLoading} error={reconciliation.error?.message} onRetry={() => reconciliation.refetch()}>
          <p className="text-xs text-slate-500">
            Doanh thu, hoa hồng, hoàn tiền và chuyển khoản tính trong tháng {month}; số dư ví và công nợ là số hiện tại. Duyệt và chuyển tiền cho
            đối tác ở <Link className="font-semibold text-action hover:underline" to="/admin/withdrawals">Rút tiền</Link>.
          </p>
          <Table minWidth="1280px">
            <THead>
              <tr>
                <SortableTh label="Đối tác" field="businessName" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Đơn" field="transactionCount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Doanh thu" field="grossAmount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Hoa hồng" field="commissionAmount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Thực nhận" field="netAmount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Hoàn tiền" field="refundAmount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Đã chuyển khoản" field="paidOutAmount" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Ví hiện tại" field="walletAvailable" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
                <SortableTh className="text-right" label="Công nợ HH" field="commissionDebt" sortField={recSort.sortField} sortOrder={recSort.sortOrder} onSort={recSort.handleSort} />
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
                  <Td className="text-right">{money(partner.paidOutAmount)}<br /><span className="text-xs text-slate-500">{partner.paidOutCount} lệnh</span></Td>
                  <Td className="text-right">
                    {money(partner.walletAvailable)}
                    <br />
                    <span className="text-xs text-slate-500">chờ QT {money(partner.walletPending)}</span>
                  </Td>
                  <Td className={`text-right ${partner.commissionDebt > 0 ? "font-semibold text-red-600" : ""}`}>{money(partner.commissionDebt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {!sortedPartners.length && (
            <EmptyState title={filtered ? "Không có đối tác phù hợp bộ lọc." : "Chưa có dữ liệu đối soát tháng này."} />
          )}
        </QueryTable>
      )}

      {tab === "transactions" && (
        <QueryTable loading={transactions.isLoading} error={transactions.error?.message} onRetry={() => transactions.refetch()}>
          <Table minWidth="1080px">
            <THead>
              <tr>
                <SortableTh label="Booking" field="bookingCode" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
                <Th>Đối tác / sân</Th>
                <SortableTh label="Loại" field="transactionType" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
                <SortableTh className="text-right" label="Doanh thu" field="grossAmount" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
                <SortableTh className="text-right" label="Hoa hồng" field="commissionAmount" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
                <SortableTh className="text-right" label="Thực nhận" field="netAmount" sortField={txSort.sortField} sortOrder={txSort.sortOrder} onSort={handleTxSort} />
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
                  <Td>{new Date(item.createdAt).toLocaleString("vi-VN")}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {transactions.data && !transactions.data.items.length && <EmptyState title="Chưa có giao dịch phù hợp." />}
          <TablePagination
            page={txPage}
            totalPages={transactions.data?.meta.totalPages ?? 1}
            total={transactions.data?.meta.total ?? 0}
            limit={txLimit}
            itemLabel="giao dịch"
            onPageChange={setTxPage}
            onLimitChange={(value) => { setTxPage(1); setTxLimit(value); }}
          />
        </QueryTable>
      )}

      {tab === "refunds" && (
        <QueryTable loading={refunds.isLoading} error={refunds.error?.message} onRetry={() => refunds.refetch()}>
          <Table minWidth="1120px">
            <THead>
              <tr>
                <SortableTh label="Booking" field="bookingCode" sortField={refundSort.sortField} sortOrder={refundSort.sortOrder} onSort={handleRefundSort} />
                <SortableTh label="Khách hàng" field="customerName" sortField={refundSort.sortField} sortOrder={refundSort.sortOrder} onSort={handleRefundSort} />
                <Th>Đối tác / sân</Th>
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
                  <Td>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${paymentStatusTones[item.paymentStatus] ?? "bg-slate-100 text-slate-700"}`}>
                      {paymentStatusLabels[item.paymentStatus] ?? item.paymentStatus}
                    </span>
                  </Td>
                  <Td>{new Date(item.refundedAt).toLocaleString("vi-VN")}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {refunds.data && !refunds.data.items.length && <EmptyState title="Chưa có hoàn tiền nào." />}
          <TablePagination
            page={refundPage}
            totalPages={refunds.data?.meta.totalPages ?? 1}
            total={refunds.data?.meta.total ?? 0}
            limit={refundLimit}
            itemLabel="lượt hoàn"
            onPageChange={setRefundPage}
            onLimitChange={(value) => { setRefundPage(1); setRefundLimit(value); }}
          />
        </QueryTable>
      )}
    </div>
  );
}

const summaryTones: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700",
  rose: "bg-rose-100 text-rose-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700"
};

function Summary({
  icon: Icon,
  tone,
  label,
  value,
  hint
}: {
  icon: ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: string | null;
  hint?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
      <span className={`shrink-0 rounded-xl p-3 ${summaryTones[tone] ?? summaryTones.slate}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold text-ink">{value ?? "—"}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${active ? "border-action bg-action text-white shadow-md" : "border-line bg-white text-ink hover:bg-field"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function QueryTable({ loading, error, onRetry, children }: { loading: boolean; error?: string; onRetry: () => void; children: ReactNode }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  return <div className="space-y-3">{children}</div>;
}

function money(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;
}
