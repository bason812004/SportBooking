import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, FolderCheck, Users, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { StatCard } from "../../components/common/StatCard";
import { Button } from "../../components/ui/Button";

const money = (v: number) => `${v.toLocaleString("vi-VN")} đ`;

export function AdminDashboardPage() {
  const qc = useQueryClient();
  const dashboard = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.dashboard });
  const approve = useMutation({
    mutationFn: adminApi.approveCourt,
    onSuccess: async () => {
      toast.success("Đã duyệt sân");
      await qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (e) => toast.error(e.message)
  });

  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;
  const d = dashboard.data!;

  const stats = [
    { label: "Người dùng", value: d.users.toLocaleString("vi-VN"), icon: Users, iconBg: "bg-blue-100 text-blue-700" },
    { label: "Đối tác", value: d.partners.toLocaleString("vi-VN"), icon: Building2, iconBg: "bg-indigo-100 text-indigo-700" },
    { label: "Sân chờ duyệt", value: d.pendingCourts.toLocaleString("vi-VN"), icon: FolderCheck, iconBg: "bg-amber-100 text-amber-700", to: "/admin/courts/pending" },
    { label: "Hoa hồng tháng", value: money(d.financials.platformCommission), icon: WalletCards, iconBg: "bg-emerald-100 text-emerald-700" }
  ];

  return (
    <div className="space-y-8">
      <PageHero eyebrow="Quản trị" title="Tổng quan hệ thống" subtitle="Số liệu thật từ booking, hoàn tiền và giao dịch hoa hồng." />

      <div className="grid gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries({
          GMV: d.financials.gmv,
          "Hoàn tiền": d.financials.refunds,
          "Platform nhận": d.financials.platformCommission,
          "Partner thực nhận": d.financials.partnerPayout
        }).map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-slate-900 p-5 text-white">
            <p className="text-slate-300">{k}</p>
            <p className="mt-2 text-2xl font-bold">{money(v)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-bold">Booking 30 ngày</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="bookings" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <div className="flex justify-between">
            <h2 className="text-xl font-bold">Sân chờ duyệt</h2>
            <Link to="/admin/courts/pending">Xem tất cả</Link>
          </div>
          <div className="mt-4 space-y-3">
            {d.pendingItems.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div>
                  <b>{c.name}</b>
                  <p className="text-sm text-slate-500">{c.address}</p>
                </div>
                <Button disabled={approve.isPending} onClick={() => approve.mutate(c.id)}>
                  Duyệt
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
