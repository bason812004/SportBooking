import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, MessageSquare, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";

const displayLabel: Record<string, { label: string; className: string }> = {
  VISIBLE: { label: "Hiển thị", className: "bg-emerald-100 text-emerald-800" },
  HIDDEN: { label: "Đã ẩn", className: "bg-slate-200 text-slate-700" }
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
        />
      ))}
      <span className="ml-1 text-sm font-bold text-slate-700">{rating}/5</span>
    </div>
  );
}

export function AdminReviewsPage() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: adminApi.reviews
  });

  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "hide" | "show" | "delete" }) =>
      type === "delete" ? adminApi.deleteReview(id) : adminApi.setReviewStatus(id, type),
    onSuccess: async () => {
      toast.success("Đã cập nhật đánh giá");
      await qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (e) => toast.error(e.message)
  });

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} />;

  const items = (q.data as any[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Nội dung" title="Đánh giá" subtitle="Quản lý đánh giá của người dùng về các sân thể thao." />

      {!items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-500">Chưa có đánh giá nào.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((r: any) => {
            const ds = displayLabel[r.displayStatus] ?? { label: r.displayStatus, className: "bg-slate-100 text-slate-700" };
            return (
              <article key={r.id} className="rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ds.className}`}>{ds.label}</span>
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">{r.court?.name}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <p className="font-bold">{r.user?.fullName}</p>
                      <StarRating rating={r.rating} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {r.comment || <span className="italic text-slate-400">Không có nội dung đánh giá</span>}
                    </p>
                    {r.createdAt && (
                      <p className="mt-2 text-xs text-slate-400">{new Date(r.createdAt).toLocaleString("vi-VN")}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: r.id, type: r.displayStatus === "VISIBLE" ? "hide" : "show" })}
                    >
                      {r.displayStatus === "VISIBLE" ? (
                        <><EyeOff className="h-4 w-4" /> Ẩn</>
                      ) : (
                        <><Eye className="h-4 w-4" /> Hiện</>
                      )}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: r.id, type: "delete" })}
                    >
                      <Trash2 className="h-4 w-4" /> Xóa
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
