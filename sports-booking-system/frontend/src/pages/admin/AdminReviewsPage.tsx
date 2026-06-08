import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";

export function AdminReviewsPage() {
  const reviews = useQuery({ queryKey: ["admin-reviews"], queryFn: adminApi.reviews });
  if (reviews.isLoading) return <LoadingState />;
  if (reviews.isError) return <ErrorState message={reviews.error.message} />;
  return <pre className="overflow-auto rounded-md border border-line bg-white p-4 text-xs">{JSON.stringify(reviews.data, null, 2)}</pre>;
}
