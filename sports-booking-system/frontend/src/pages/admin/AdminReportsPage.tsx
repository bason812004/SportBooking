import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";

export function AdminReportsPage() {
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: adminApi.reports });
  if (reports.isLoading) return <LoadingState />;
  if (reports.isError) return <ErrorState message={reports.error.message} />;
  return <pre className="overflow-auto rounded-md border border-line bg-white p-4 text-xs">{JSON.stringify(reports.data, null, 2)}</pre>;
}
