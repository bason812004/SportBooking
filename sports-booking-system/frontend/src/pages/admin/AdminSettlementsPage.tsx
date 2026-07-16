import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { formatCurrency } from "../../lib/format";
import { SettlementStatusBadge, WithdrawalStatusBadge } from "./StatusBadges";

export function AdminSettlementsPage() {
  const [page] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settlements", page, statusFilter],
    queryFn: () => adminApi.settlements({ page, limit: 20, status: statusFilter || undefined })
  });

  const summary = useQuery({
    queryKey: ["admin-settlements-summary"],
    queryFn: adminApi.settlementSummary
  });

  if (isLoading) return <LoadingState />;
  if (!data) return <ErrorState message="Không thể tải dữ liệu" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Quản lý Quyết toán</h1>
        <p className="mt-1 text-slate-500">Quản lý settlement và chuyển tiền cho Partner</p>
      </div>

      {/* Summary Cards */}
      {summary.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Tổng doanh thu gốc", value: formatCurrency(summary.data.grossAmount), color: "text-blue-600" },
            { label: "Tổng hoa hồng", value: formatCurrency(summary.data.commissionAmount), color: "text-purple-600" },
            { label: "Tổng thực nhận", value: formatCurrency(summary.data.netAmount), color: "text-emerald-600" },
            { label: "Đang chờ quyết toán", value: formatCurrency(summary.data.pendingAmount) + ` (${summary.data.pendingCount})`, color: "text-amber-600" }
          ].map(card => (
            <div key={card.label} className="rounded-2xl border bg-white p-5">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">Chờ quyết toán</option>
          <option value="SETTLED">Đã quyết toán</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-white">
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="p-3 text-left font-semibold">Mã booking</th>
                <th className="p-3 text-left font-semibold">Partner</th>
                <th className="p-3 text-right font-semibold">Giá gốc</th>
                <th className="p-3 text-right font-semibold">Giảm voucher</th>
                <th className="p-3 text-right font-semibold">Hoa hồng</th>
                <th className="p-3 text-right font-semibold">Thực nhận</th>
                <th className="p-3 text-center font-semibold">Trạng thái</th>
                <th className="p-3 text-right font-semibold">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">Chưa có settlement nào</td>
                </tr>
              ) : (
                data.items.map(s => (
                  <tr key={s.id} className="border-t hover:bg-slate-50">
                    <td className="p-3 font-mono text-sm">{s.booking?.bookingCode}</td>
                    <td className="p-3">
                      <p className="font-medium">{s.partner?.businessName}</p>
                    </td>
                    <td className="p-3 text-right">{formatCurrency(s.grossAmount)}</td>
                    <td className="p-3 text-right text-red-600">{formatCurrency(s.voucherDiscount)}</td>
                    <td className="p-3 text-right text-purple-600">{formatCurrency(s.commissionAmount)}</td>
                    <td className="p-3 text-right font-semibold text-emerald-600">{formatCurrency(s.netAmount)}</td>
                    <td className="p-3 text-center"><SettlementStatusBadge status={s.status} /></td>
                    <td className="p-3 text-right text-slate-500">
                      {new Date(s.createdAt).toLocaleDateString("vi-VN")}
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
