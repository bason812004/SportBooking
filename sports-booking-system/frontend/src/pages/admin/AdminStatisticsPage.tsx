import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";

export function AdminStatisticsPage() {
  const statistics = useQuery({ queryKey: ["admin-statistics"], queryFn: adminApi.statistics });
  if (statistics.isLoading) return <LoadingState />;
  if (statistics.isError) return <ErrorState message={statistics.error.message} />;
  return <pre className="overflow-auto rounded-md border border-line bg-white p-4 text-xs">{JSON.stringify(statistics.data, null, 2)}</pre>;
}
