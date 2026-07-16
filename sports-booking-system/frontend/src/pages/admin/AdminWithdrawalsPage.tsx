import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { formatCurrency } from "../../lib/format";
import { WithdrawalStatusBadge } from "./StatusBadges";
import { Button } from "../../components/ui/Button";
import { toast } from "sonner";

export function AdminWithdrawalsPage() {
  const [page] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals", page, statusFilter],
    queryFn: () => adminApi.withdrawals({ page, limit: 20, status: statusFilter || undefined })
  });

  const summary = useQuery({
    queryKey: ["admin-withdrawals-summary"],
    queryFn: adminApi.withdrawalSummary
  });

  const settleMutation = useMutation({
    mutationFn: (id: string) => adminApi.settleSettlement(id),
    onSuccess: () => {
      toast.success("Đã quyết toán settlement!");
      queryClient.invalidateQueries({ queryKey: ["admin-settlements"] });
      queryClient.invalidateQueries({ queryKey: ["admin-settlements-summary"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Lỗi")
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveWithdrawal(id),
    onSuccess: () => {
      toast.success("Đã duyệt yêu cầu!");
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Lỗi")
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminApi.rejectWithdrawal(id),
    onSuccess: () => {
      toast.success("Đã từ chối yêu cầu!");
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Lỗi")
  });

  const paidMutation = useMutation({
    mutationFn: (id: string) => adminApi.markWithdrawalPaid(id),
    onSuccess: () => {
      toast.success("Đã xác nhận thanh toán!");
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Lỗi")
  });

  if (isLoading) return <LoadingState />;
  if (!data) return <ErrorState message="Không thể tải dữ liệu" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Quản lý Rút tiền</h1>
        <p className="mt-1 text-slate-500">Duyệt và xác nhận yêu cầu rút tiền từ Partner</p>
      </div>

      {/* Summary */}
      {summary.data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">Tổng yêu cầu</p>
            <p className="mt-1 text-xl font-bold">{summary.data.totalCount} yêu cầu · {formatCurrency(summary.data.totalAmount)}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm text-amber-700">Đang chờ duyệt</p>
            <p className="mt-1 text-xl font-bold text-amber-700">{summary.data.pendingCount} yêu cầu · {formatCurrency(summary.data.pendingAmount)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm text-emerald-700">Đã thanh toán</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{summary.data.paidCount} yêu cầu · {formatCurrency(summary.data.paidAmount)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Tất cả</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="PAID">Đã thanh toán</option>
          <option value="REJECTED">Từ chối</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-white">
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="p-3 text-left font-semibold">Partner</th>
                <th className="p-3 text-right font-semibold">Số tiền</th>
                <th className="p-3 text-left font-semibold">Ngân hàng</th>
                <th className="p-3 text-left font-semibold">Tài khoản</th>
                <th className="p-3 text-center font-semibold">Trạng thái</th>
                <th className="p-3 text-right font-semibold">Ngày tạo</th>
                <th className="p-3 text-center font-semibold">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">Chưa có yêu cầu rút tiền nào</td>
                </tr>
              ) : (
                data.items.map(w => (
                  <tr key={w.id} className="border-t hover:bg-slate-50">
                    <td className="p-3">
                      <p className="font-medium">{w.partnerName}</p>
                      <p className="text-xs text-slate-500">{w.ownerName}</p>
                    </td>
                    <td className="p-3 text-right font-semibold text-emerald-600">{formatCurrency(w.amount)}</td>
                    <td className="p-3">{w.bankName}</td>
                    <td className="p-3">
                      <p className="font-medium">{w.bankAccountName}</p>
                      <p className="font-mono text-xs text-slate-500">{w.bankAccountNumber}</p>
                    </td>
                    <td className="p-3 text-center"><WithdrawalStatusBadge status={w.status} /></td>
                    <td className="p-3 text-right text-slate-500">{new Date(w.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {w.status === "PENDING" && (
                          <>
                            <Button variant="secondary" onClick={() => approveMutation.mutate(w.id)} className="px-3 py-1 text-xs">Duyệt</Button>
                            <Button variant="danger" onClick={() => rejectMutation.mutate(w.id)} className="px-3 py-1 text-xs">Từ chối</Button>
                          </>
                        )}
                        {w.status === "APPROVED" && (
                          <Button className="bg-emerald-600 px-3 py-1 text-xs hover:bg-emerald-700" onClick={() => paidMutation.mutate(w.id)}>
                            Xác nhận thanh toán
                          </Button>
                        )}
                        {w.status === "REJECTED" && <span className="text-xs text-slate-500">Đã từ chối</span>}
                        {w.status === "PAID" && <span className="text-xs text-emerald-600">Hoàn tất</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data.meta.total > 20 && (
          <div className="border-t p-4 text-center text-sm text-slate-500">
            Hiển thị {data.items.length} / {data.meta.total} kết quả
          </div>
        )}
      </div>
    </div>
  );
}
