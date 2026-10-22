import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Flag, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";

const statusLabel: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ xử lý", className: "bg-amber-100 text-amber-800" },
  RESOLVED: { label: "Đã xử lý", className: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Bác bỏ", className: "bg-red-100 text-red-800" }
};

export function AdminReportsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ["admin-reports", page],
    queryFn: () => adminApi.reports({ page, limit: 10 }),
    placeholderData: keepPreviousData
  });

  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "resolve" | "reject" }) =>
      adminApi.setReportStatus(id, type),
    onSuccess: async () => {
      toast.success("Đã xử lý báo cáo");
      await qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (e) => toast.error(e.message)
  });

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} />;

  const items = q.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Bảo mật" title="Báo cáo vi phạm" subtitle="Xem xét và xử lý các báo cáo vi phạm từ người dùng." />

      {!items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
          <Flag className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-500">Không có báo cáo vi phạm nào.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((r: any) => {
            const st = statusLabel[r.status] ?? { label: r.status, className: "bg-slate-100 text-slate-700" };
            return (
              <article key={r.id} className="rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.className}`}>{st.label}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{r.court?.name}</span>
                    </div>
                    <h2 className="mt-2 flex items-center gap-2 text-lg font-bold">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      {r.reason}
                    </h2>
                    {r.description && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">{r.description}</p>
                    )}
                    <p className="mt-2 text-sm text-slate-400">
                      Người báo cáo: <span className="font-semibold text-slate-600">{r.user?.fullName}</span>
                      {r.createdAt && <> · {new Date(r.createdAt).toLocaleString("vi-VN")}</>}
                    </p>
                  </div>
                  {r.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button disabled={action.isPending} onClick={() => action.mutate({ id: r.id, type: "resolve" })}>
                        <CheckCircle2 className="h-4 w-4" /> Đã xử lý
                      </Button>
                      <Button disabled={action.isPending} variant="danger" onClick={() => action.mutate({ id: r.id, type: "reject" })}>
                        <XCircle className="h-4 w-4" /> Bác bỏ
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pager page={page} total={q.data?.meta?.totalPages ?? 1} setPage={setPage} />
    </div>
  );
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (v: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex justify-end gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
      <span className="py-2 text-sm font-semibold">{page}/{Math.max(total, 1)}</span>
      <Button variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)}>Sau</Button>
    </div>
  );
}
