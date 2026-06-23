import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ReceiptText, RefreshCcw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
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

export function AdminFinancePage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<"reconciliation" | "transactions" | "refunds">("reconciliation");
  const [search, setSearch] = useState("");
  const [partnerId, setPartnerId] = useState("");

  const reconciliation = useQuery({
    queryKey: ["admin-finance-reconciliation", month],
    queryFn: () => adminApi.financeReconciliation(month)
  });
  const transactions = useQuery({
    queryKey: ["admin-finance-transactions", month, search, partnerId],
    queryFn: () => adminApi.financeTransactions({ month, search, partnerId, limit: 50 })
  });
  const refunds = useQuery({
    queryKey: ["admin-finance-refunds", month, search, partnerId],
    queryFn: () => adminApi.financeRefunds({ month, search, partnerId, limit: 50 })
  });

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Tài chính</h1>
          <p className="text-sm text-slate-600">Theo dõi giao dịch, hoàn tiền, đối soát doanh thu partner và trạng thái payout.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input label="Tháng" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          <Button variant="secondary" disabled={exportReport.isPending} onClick={() => exportReport.mutate()}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

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
        <Input label="Tìm kiếm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mã booking, sân, partner, khách hàng" />
        <Input label="ID partner" value={partnerId} onChange={(event) => setPartnerId(event.target.value)} placeholder="pp0001" />
      </div>

      {tab === "reconciliation" && reconciliation.data && (
        <div className="overflow-auto rounded-lg border bg-white">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="p-3">Partner</th>
                <th className="text-right">Giao dịch</th>
                <th className="text-right">Doanh thu</th>
                <th className="text-right">Hoa hồng</th>
                <th className="text-right">Thực nhận</th>
                <th className="text-right">Hoàn tiền</th>
                <th>Trạng thái payout</th>
                <th>Đã chi trả</th>
              </tr>
            </thead>
            <tbody>
              {reconciliation.data.partners.map((partner) => (
                <tr key={partner.partnerId} className="border-t">
                  <td className="p-3 font-medium">{partner.businessName}<br /><span className="text-xs text-slate-500">{partner.partnerId}</span></td>
                  <td className="text-right">{partner.transactionCount}</td>
                  <td className="text-right">{money(partner.grossAmount)}</td>
                  <td className="text-right text-red-600">{money(partner.commissionAmount)}</td>
                  <td className="text-right font-semibold text-emerald-700">{money(partner.netAmount)}</td>
                  <td className="text-right">{money(partner.refundAmount)}<br /><span className="text-xs text-slate-500">{partner.refundCount} lượt</span></td>
                  <td className="py-2">
                    <Select
                      value={partner.payoutStatus}
                      onChange={(event) => payout.mutate({ partner, status: event.target.value })}
                      options={payoutStatuses.map((status) => ({ value: status, label: payoutLabels[status] }))}
                    />
                  </td>
                  <td>{partner.paidAt ? new Date(partner.paidAt).toLocaleString("vi-VN") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!reconciliation.data.partners.length && <p className="p-6 text-center text-slate-500">Chưa có dữ liệu đối soát tháng này</p>}
        </div>
      )}

      {tab === "transactions" && (
        <QueryTable loading={transactions.isLoading} error={transactions.error?.message}>
          <table className="w-full min-w-[1160px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="p-3">Booking</th>
                <th>Partner / sân</th>
                <th>Loại</th>
                <th className="text-right">Doanh thu</th>
                <th className="text-right">Hoa hồng</th>
                <th className="text-right">Thực nhận</th>
                <th>Payout</th>
                <th>Ngày ghi nhận</th>
              </tr>
            </thead>
            <tbody>
              {transactions.data?.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3 font-medium">{item.bookingCode}<br /><span className="text-xs text-slate-500">{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</span></td>
                  <td>{item.businessName}<br /><span className="text-xs text-slate-500">{item.courtName}</span></td>
                  <td>{transactionLabels[item.transactionType] ?? item.transactionType}<br /><span className="text-xs text-slate-500">{eventLabels[item.eventType] ?? item.eventType}</span></td>
                  <td className="text-right">{money(item.grossAmount)}</td>
                  <td className="text-right text-red-600">{money(item.commissionAmount)}<br /><span className="text-xs text-slate-500">{item.commissionRate}%</span></td>
                  <td className="text-right font-semibold text-emerald-700">{money(item.netAmount)}</td>
                  <td><Status value={item.payoutStatus} /></td>
                  <td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryTable>
      )}

      {tab === "refunds" && (
        <QueryTable loading={refunds.isLoading} error={refunds.error?.message}>
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="p-3">Booking</th>
                <th>Khách hàng</th>
                <th>Partner / sân</th>
                <th className="text-right">Tổng tiền</th>
                <th className="text-right">Hoàn tiền</th>
                <th className="text-right">Nền tảng giữ lại</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {refunds.data?.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3 font-medium">{item.bookingCode}<br /><span className="text-xs text-slate-500">{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</span></td>
                  <td>{item.user.fullName}<br /><span className="text-xs text-slate-500">{item.user.email}</span></td>
                  <td>{item.court.partner.businessName}<br /><span className="text-xs text-slate-500">{item.court.name}</span></td>
                  <td className="text-right">{money(item.totalPrice)}</td>
                  <td className="text-right text-red-600">{money(item.refundAmount)}</td>
                  <td className="text-right">{money(item.platformRetainedAmount)}</td>
                  <td>{item.paymentStatus}</td>
                  <td>{new Date(item.refundedAt).toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryTable>
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
  return <div className="overflow-auto rounded-lg border bg-white">{children}</div>;
}

function Status({ value }: { value: string }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{payoutLabels[value] ?? value}</span>;
}

function money(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;
}
