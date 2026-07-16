import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Banknote, Clock, History, TrendingUp, Wallet } from "lucide-react";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { toast } from "sonner";
import { formatCurrency } from "../../lib/format";
import { useLanguage } from "../../lib/i18n";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    SETTLED: "bg-emerald-100 text-emerald-800",
    FAILED: "bg-red-100 text-red-800",
    CANCELLED: "bg-slate-100 text-slate-600",
    APPROVED: "bg-blue-100 text-blue-800",
    REJECTED: "bg-red-100 text-red-800",
    PAID: "bg-emerald-100 text-emerald-800"
  };
  const labels: Record<string, string> = {
    PENDING: "Chờ quyết toán",
    PROCESSING: "Đang xử lý",
    SETTLED: "Đã quyết toán",
    FAILED: "Thất bại",
    CANCELLED: "Đã hủy",
    APPROVED: "Đã duyệt",
    REJECTED: "Từ chối",
    PAID: "Đã thanh toán"
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function PartnerWalletPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "settlements" | "withdrawals">("overview");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const wallet = useQuery({
    queryKey: ["partner-wallet"],
    queryFn: partnerApi.wallet
  });

  const settlements = useQuery({
    queryKey: ["partner-settlements"],
    queryFn: () => partnerApi.settlements({ page: 1, limit: 20 })
  });

  const withdrawals = useQuery({
    queryKey: ["partner-withdrawals"],
    queryFn: () => partnerApi.withdrawals({ page: 1, limit: 20 })
  });

  if (wallet.isLoading) return <LoadingState />;
  if (wallet.isError) return <ErrorState message={(wallet.error as Error)?.message} />;

  const w = wallet.data!;
  const statCards = [
    { label: "Số dư khả dụng", value: formatCurrency(w.availableBalance), icon: Wallet, color: "text-emerald-600 bg-emerald-50" },
    { label: "Đang chờ quyết toán", value: formatCurrency(w.pendingBalance), icon: Clock, color: "text-amber-600 bg-amber-50" },
    { label: "Tổng doanh thu", value: formatCurrency(w.totalEarned), icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
    { label: "Đã rút", value: formatCurrency(w.totalWithdrawn), icon: Banknote, color: "text-purple-600 bg-purple-50" }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Ví & Quyết toán</h1>
        <p className="mt-1 text-slate-500">Quản lý doanh thu và rút tiền từ hệ thống</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(card => (
          <div key={card.label} className="rounded-2xl border bg-white p-5">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-0.5 text-xl font-bold">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Withdraw CTA */}
      {w.availableBalance > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div>
            <p className="font-semibold text-emerald-800">Sẵn sàng rút tiền</p>
            <p className="mt-0.5 text-sm text-emerald-700">
              Bạn có <b>{formatCurrency(w.availableBalance)}</b> VND có thể rút ngay
            </p>
          </div>
          <Button onClick={() => setShowWithdrawModal(true)} className="shrink-0 bg-emerald-600 hover:bg-emerald-700">
            Rút tiền
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-white p-1">
        {[
          { key: "overview", label: "Tổng quan" },
          { key: "settlements", label: "Lịch sử quyết toán", count: settlements.data?.meta.total },
          { key: "withdrawals", label: "Lịch sử rút tiền", count: withdrawals.data?.meta.total }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.key ? "bg-white/20" : "bg-slate-200"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <TrendingUp className="h-5 w-5 text-emerald-600" /> Quy tắc quyết toán
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">1</span>
                <p>Khi booking được thanh toán thành công, hệ thống tự động tạo Settlement</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">2</span>
                <p>Tiền được cộng vào <b>Đang chờ quyết toán</b> (Pending Balance)</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">3</span>
                <p>Khi booking hoàn thành, tiền chuyển sang <b>Số dư khả dụng</b> (Available Balance)</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">4</span>
                <p>Partner tạo yêu cầu rút tiền, Admin duyệt và xác nhận đã chuyển khoản</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <History className="h-5 w-5 text-blue-600" /> Quy tắc tính doanh thu
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-medium">Giá gốc sân</p>
                <p className="text-slate-600">Tổng giá từ các slot đã đặt + dịch vụ đi kèm</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-medium">Hoa hồng hệ thống</p>
                <p className="text-slate-600">Hệ thống giữ % hoa hồng từ doanh thu gốc (không tính voucher Partner)</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="font-medium text-emerald-800">Partner nhận</p>
                <p className="text-emerald-700">Giá gốc - Hoa hồng = Doanh thu thực nhận</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="font-medium text-amber-800">Lưu ý</p>
                <p className="text-amber-700">Voucher của Partner giảm doanh thu gốc. Voucher Platform là chi phí marketing của hệ thống.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "settlements" && (
        <div className="rounded-2xl border bg-white">
          <div className="border-b p-4">
            <h2 className="font-bold">Danh sách quyết toán</h2>
          </div>
          {settlements.isLoading ? (
            <div className="p-8 text-center text-slate-500">Đang tải...</div>
          ) : settlements.data?.items.length === 0 ? (
            <EmptyState title="Chưa có quyết toán nào" description="Settlement sẽ xuất hiện khi có booking được thanh toán" />
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Mã booking</th>
                    <th className="p-3 text-left font-semibold">Sân</th>
                    <th className="p-3 text-right font-semibold">Doanh thu gốc</th>
                    <th className="p-3 text-right font-semibold">Hoa hồng</th>
                    <th className="p-3 text-right font-semibold">Thực nhận</th>
                    <th className="p-3 text-center font-semibold">Trạng thái</th>
                    <th className="p-3 text-right font-semibold">Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.data?.items.map(s => (
                    <tr key={s.id} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-mono text-sm">{s.booking?.bookingCode}</td>
                      <td className="p-3">{s.booking?.court?.name}</td>
                      <td className="p-3 text-right">{formatCurrency(s.grossAmount)}</td>
                      <td className="p-3 text-right text-red-600">{formatCurrency(s.commissionAmount)}</td>
                      <td className="p-3 text-right font-semibold text-emerald-600">{formatCurrency(s.netAmount)}</td>
                      <td className="p-3 text-center"><StatusBadge status={s.status} /></td>
                      <td className="p-3 text-right text-slate-500">
                        {new Date(s.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "withdrawals" && (
        <div className="rounded-2xl border bg-white">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-bold">Lịch sử rút tiền</h2>
            <Button
              onClick={() => setShowWithdrawModal(true)}
              disabled={w.availableBalance <= 0}
              className="bg-emerald-600 px-3 py-1 text-xs hover:bg-emerald-700 disabled:opacity-50"
            >
              Tạo yêu cầu rút
            </Button>
          </div>
          {withdrawals.isLoading ? (
            <div className="p-8 text-center text-slate-500">Đang tải...</div>
          ) : withdrawals.data?.items.length === 0 ? (
            <EmptyState title="Chưa có yêu cầu rút tiền" description="Tạo yêu cầu rút khi có số dư khả dụng" />
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Số tiền</th>
                    <th className="p-3 text-left font-semibold">Tài khoản</th>
                    <th className="p-3 text-center font-semibold">Trạng thái</th>
                    <th className="p-3 text-left font-semibold">Ngày tạo</th>
                    <th className="p-3 text-left font-semibold">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.data?.items.map(w => (
                    <tr key={w.id} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-semibold text-emerald-600">{formatCurrency(w.amount)}</td>
                      <td className="p-3">
                        <p className="font-medium">{w.bankAccountName}</p>
                        <p className="text-xs text-slate-500">{w.bankName} · {w.bankAccountNumber}</p>
                      </td>
                      <td className="p-3 text-center"><StatusBadge status={w.status} /></td>
                      <td className="p-3 text-slate-500">{new Date(w.createdAt).toLocaleDateString("vi-VN")}</td>
                      <td className="p-3 text-slate-500">{w.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <WithdrawModal
          available={w.availableBalance}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            setShowWithdrawModal(false);
            queryClient.invalidateQueries({ queryKey: ["partner-wallet"] });
            queryClient.invalidateQueries({ queryKey: ["partner-withdrawals"] });
          }}
        />
      )}
    </div>
  );
}

function WithdrawModal({ available, onClose, onSuccess }: { available: number; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(String(available));
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createMutation = useMutation({
    mutationFn: partnerApi.createWithdrawal,
    onSuccess: () => {
      toast.success("Yêu cầu rút tiền đã được gửi!");
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Không thể tạo yêu cầu");
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (numAmount <= 0) { toast.error("Số tiền phải lớn hơn 0"); return; }
    if (numAmount > available) { toast.error("Số tiền vượt quá số dư khả dụng"); return; }
    if (!bankName || !accountNumber || !accountName) { toast.error("Vui lòng điền đầy đủ thông tin"); return; }
    setIsSubmitting(true);
    await createMutation.mutateAsync({ amount: numAmount, bankName, bankAccountNumber: accountNumber, bankAccountName: accountName });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold">Yêu cầu rút tiền</h2>
        <p className="mt-1 text-sm text-slate-500">Số dư khả dụng: <b>{formatCurrency(available)}</b> VND</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Số tiền rút (VND)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              max={available}
              min={10000}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Nhập số tiền"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tên ngân hàng</label>
            <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="VD: Vietcombank" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Số tài khoản</label>
            <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Nhập số tài khoản" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tên tài khoản</label>
            <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Tên chủ tài khoản" required />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Hủy</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
              {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
