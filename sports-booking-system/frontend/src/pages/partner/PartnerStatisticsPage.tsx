import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { useLanguage } from "../../lib/i18n";

export function PartnerStatisticsPage() {
  const { t } = useLanguage();
  const revenue = useQuery({ queryKey: ["partner-revenue"], queryFn: partnerApi.revenue });
  if (revenue.isLoading) return <LoadingState />;
  if (revenue.isError) return <ErrorState message={revenue.error.message} />;
  const data = (revenue.data as Array<{ bookingStatus: string; _sum: { totalPrice: string }; _count: number }>) ?? [];
  return (
    <div className="h-[420px] rounded-md border border-line bg-white p-5">
      <h1 className="mb-4 text-2xl font-semibold">{t("Doanh thu theo trạng thái")}</h1>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data.map((item) => ({ status: item.bookingStatus, revenue: Number(item._sum.totalPrice ?? 0), count: item._count }))}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="status" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="revenue" fill="#1f8a5b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
