import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { AdminReasonModal } from "./AdminReasonModal";
import { PageHero } from "../../components/common/PageHero";

const approvalLabel: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Từ chối", className: "bg-red-100 text-red-800" }
};

const statusFilterOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Từ chối" }
];

export function AdminPartnersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  const list = useQuery({
    queryKey: ["admin-partners", page, search, status],
    queryFn: () => adminApi.partners({ page, limit: 10, search, status }),
    placeholderData: keepPreviousData
  });

  const detail = useQuery({
    queryKey: ["admin-partner", expandedId],
    queryFn: () => adminApi.partnerDetail(expandedId!),
    enabled: Boolean(expandedId)
  });

  const action = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject"; reason: string }) =>
      action === "approve" ? adminApi.approvePartner(id, reason) : adminApi.rejectPartner(id, reason),
    onSuccess: async () => {
      toast.success("Đã cập nhật đối tác");
      setPending(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-partners"] }),
        qc.invalidateQueries({ queryKey: ["admin-partner"] })
      ]);
    },
    onError: (e) => toast.error(e.message)
  });

  if (list.isLoading) return <LoadingState />;
  if (list.isError) return <ErrorState message={list.error.message} />;

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Quản trị" title="Đối tác" subtitle="Quản lý và duyệt hồ sơ đối tác kinh doanh sân thể thao." />

      <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2">
        <Input label="Tìm doanh nghiệp, email" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <Select label="Trạng thái" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} options={statusFilterOptions} />
      </div>

      {!items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
          <Building2 className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-500">Không tìm thấy đối tác phù hợp.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((p: any) => {
            const approval = approvalLabel[p.approvalStatus] ?? { label: p.approvalStatus, className: "bg-slate-100 text-slate-700" };
            const isExpanded = expandedId === p.id;
            return (
              <article key={p.id} className="rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${approval.className}`}>{approval.label}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-bold">{p.businessName}</h2>
                    <p className="text-sm text-slate-500">{p.user?.email}</p>
                    {p.verificationDocumentUrl && (
                      <a className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline" href={p.verificationDocumentUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Xem giấy tờ xác minh
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Chi tiết
                    </Button>
                    <Link to={`/admin/partners/${p.id}/commission`}>
                      <Button variant="secondary">Hoa hồng</Button>
                    </Link>
                    {p.approvalStatus === "PENDING" && (
                      <>
                        <Button disabled={action.isPending} onClick={() => setPending({ id: p.id, action: "approve" })}>
                          <CheckCircle2 className="h-4 w-4" /> Duyệt
                        </Button>
                        <Button disabled={action.isPending} variant="danger" onClick={() => setPending({ id: p.id, action: "reject" })}>
                          <XCircle className="h-4 w-4" /> Từ chối
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && detail.data && (
                  <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-400">Địa chỉ</p>
                        <p className="mt-1 text-sm font-semibold">{detail.data.address || "Chưa cập nhật"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-400">Ngân hàng</p>
                        <p className="mt-1 text-sm font-semibold">{detail.data.bankName || "Chưa cập nhật"}</p>
                        <p className="text-sm text-slate-500">{detail.data.bankAccountNumber || ""}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-400">Lịch sử duyệt</p>
                      <div className="mt-2 space-y-2">
                        {detail.data.history?.length ? detail.data.history.map((h: any) => (
                          <div key={h.id} className="rounded-lg bg-slate-50 p-2.5">
                            <p className="text-sm font-semibold">
                              <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-bold ${h.action === "APPROVED" ? "bg-emerald-100 text-emerald-800" : h.action === "REJECTED" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>
                                {h.action === "APPROVED" ? "Duyệt" : h.action === "REJECTED" ? "Từ chối" : h.action}
                              </span>
                              {new Date(h.createdAt).toLocaleString("vi-VN")}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">{h.reason || "Không ghi chú"}</p>
                          </div>
                        )) : (
                          <p className="text-sm text-slate-400">Chưa có lịch sử</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {isExpanded && detail.isLoading && <div className="mt-4 text-center text-sm text-slate-400">Đang tải...</div>}
              </article>
            );
          })}
        </div>
      )}

      <Pager page={page} total={list.data?.meta?.totalPages ?? 1} setPage={setPage} />

      <AdminReasonModal
        open={Boolean(pending)}
        title={pending?.action === "reject" ? "Từ chối đối tác" : "Duyệt đối tác"}
        required={pending?.action === "reject"}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && action.mutate({ ...pending, reason })}
      />
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
