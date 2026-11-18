import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Lock, Unlock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { LockAccountModal } from "../../features/admin/components/LockAccountModal";
import type { AdminPartner, AdminPartnerListItem, CourtReviewCheck } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { TablePagination } from "../../components/common/TablePagination";
import { ReasonModal } from "../../components/common/ReasonModal";
import { PageHero } from "../../components/common/PageHero";
import { ReportExportButtons } from "../../components/common/ReportExportButtons";
import { useDebounce } from "../../hooks/useDebounce";
import { formatDate, httpUrl } from "../../lib/format";

const approvalLabel: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Từ chối", className: "bg-red-100 text-red-800" }
};

const courtApprovalLabel: Record<string, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối" };

const statusFilterOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Từ chối" }
];

export function AdminPartnersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  // ?status=PENDING comes from the "đối tác cần duyệt" notification, ?search=<email> from the court review page.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  // The search box only queries once the admin pauses typing.
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  useEffect(() => {
    const statusFromUrl = searchParams.get("status");
    const searchFromUrl = searchParams.get("search");
    if (statusFromUrl) setStatus(statusFromUrl);
    if (searchFromUrl) setSearch(searchFromUrl);
    if (statusFromUrl || searchFromUrl) setPage(1);
  }, [searchParams]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [locking, setLocking] = useState<AdminPartnerListItem | null>(null);

  const list = useQuery({
    queryKey: ["admin-partners", page, limit, debouncedSearch, status],
    queryFn: () => adminApi.partners({ page, limit, search: debouncedSearch, status }),
    placeholderData: keepPreviousData
  });

  const detail = useQuery({
    queryKey: ["admin-partner", expandedId],
    queryFn: () => adminApi.partnerDetail(expandedId!),
    enabled: Boolean(expandedId)
  });

  // A decision can move the last partner of a filtered last page out of the filter.
  const totalPages = list.data?.meta.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-partners"] }),
      qc.invalidateQueries({ queryKey: ["admin-partner"] }),
      // Court approval depends on the partner being approved, and a locked partner's courts leave the public pages.
      qc.invalidateQueries({ queryKey: ["admin-court-review"] }),
      qc.invalidateQueries({ queryKey: ["admin-pending-courts"] }),
      qc.invalidateQueries({ queryKey: ["admin-users"] })
    ]);

  const action = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject"; reason: string }) =>
      action === "approve" ? adminApi.approvePartner(id, reason) : adminApi.rejectPartner(id, reason),
    onSuccess: async (_result, { action }) => {
      toast.success(action === "approve" ? "Đã duyệt đối tác và gửi thông báo" : "Đã từ chối đối tác và gửi lý do cho đối tác");
      setPending(null);
      await refresh();
    },
    onError: (e) => toast.error(e.message)
  });

  const unlock = useMutation({
    mutationFn: (partner: AdminPartnerListItem) => adminApi.unlockUser(partner.user.id),
    onSuccess: async (_result, partner) => {
      toast.success(`Đã mở khóa tài khoản ${partner.businessName}, sân của đối tác hiển thị lại`);
      await refresh();
    },
    onError: (e) => toast.error(e.message)
  });

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Quản trị" title="Đối tác" subtitle="Quản lý và duyệt hồ sơ đối tác kinh doanh sân thể thao." />

      <div className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Tìm doanh nghiệp, người đại diện, email, SĐT, MST" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
          <Select label="Trạng thái" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} options={statusFilterOptions} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-3">
          <span className="text-sm text-slate-500">Xuất danh sách đối tác theo tìm kiếm và trạng thái đang chọn (số tài khoản chỉ hiện 4 số cuối)</span>
          <ReportExportButtons
            filenameBase={`doi-tac-${new Date().toISOString().slice(0, 10)}`}
            onExport={(format) => adminApi.exportPartners({ search: debouncedSearch, status }, format)}
          />
        </div>
      </div>

      {/* Loading and errors replace only the list, so the filters above always stay usable. */}
      {list.isLoading ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : !items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
          <Building2 className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-500">Không tìm thấy đối tác phù hợp.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {items.map((p) => {
              const approval = approvalLabel[p.approvalStatus] ?? { label: p.approvalStatus, className: "bg-slate-100 text-slate-700" };
              const isExpanded = expandedId === p.id;
              const locked = p.user.status === "LOCKED";
              return (
                <article key={p.id} className="rounded-2xl border bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${approval.className}`}>{approval.label}</span>
                        {locked && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">Tài khoản bị khóa · sân đang ẩn</span>}
                        {p.missingChecks > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" /> Thiếu {p.missingChecks} mục hồ sơ
                          </span>
                        )}
                      </div>
                      <h2 className="mt-2 text-lg font-bold">{p.businessName}</h2>
                      <p className="text-sm text-slate-500">
                        {p.user.fullName} · {p.user.email}
                        {p.user.phone ? ` · ${p.user.phone}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {p.courtCount} sân · Đăng ký {formatDate(p.createdAt)}
                      </p>
                      {httpUrl(p.verificationDocumentUrl) && (
                        <a className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline" href={httpUrl(p.verificationDocumentUrl)!} target="_blank" rel="noopener noreferrer">
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
                      {locked ? (
                        <Button variant="secondary" disabled={unlock.isPending} onClick={() => unlock.mutate(p)}>
                          <Unlock className="h-4 w-4" /> Mở khóa tài khoản
                        </Button>
                      ) : (
                        <Button variant="secondary" className="text-red-700" onClick={() => setLocking(p)}>
                          <Lock className="h-4 w-4" /> Khóa tài khoản
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && detail.data && <PartnerDetail partner={detail.data} />}
                  {isExpanded && detail.isLoading && <div className="mt-4 text-center text-sm text-slate-400">Đang tải...</div>}
                  {isExpanded && detail.isError && <p className="mt-4 text-center text-sm text-red-600">{detail.error.message}</p>}
                </article>
              );
            })}
          </div>

          <TablePagination
            page={page}
            totalPages={list.data?.meta.totalPages ?? 1}
            total={list.data?.meta.total ?? 0}
            limit={limit}
            itemLabel="đối tác"
            onPageChange={setPage}
            onLimitChange={(value) => {
              setPage(1);
              setLimit(value);
            }}
          />
        </>
      )}

      <ReasonModal
        open={Boolean(pending)}
        title={pending?.action === "reject" ? "Từ chối đối tác" : "Duyệt đối tác"}
        required={pending?.action === "reject"}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && action.mutate({ ...pending, reason })}
      />

      <LockAccountModal
        account={locking && { id: locking.user.id, fullName: locking.businessName, role: "PARTNER" }}
        onClose={() => setLocking(null)}
        onLocked={() => void refresh()}
      />
    </div>
  );
}

function CheckItem({ check }: { check: CourtReviewCheck }) {
  const [Icon, tone] = check.status === "ok" ? [CheckCircle2, "text-emerald-600"] : [AlertTriangle, "text-amber-500"];
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      <span className={check.status === "ok" ? "text-slate-700" : "text-slate-600"}>{check.label}</span>
    </li>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-800">{children}</div>
    </div>
  );
}

const missing = <span className="font-normal text-slate-400">Chưa cập nhật</span>;

function PartnerDetail({ partner }: { partner: AdminPartner }) {
  const courts = partner.courts ?? [];
  return (
    <div className="mt-4 grid gap-5 border-t pt-4 lg:grid-cols-3">
      <div className="space-y-3">
        <Field label="Người đại diện">
          {partner.user.fullName}
          <p className="font-normal text-slate-500">{partner.user.email}{partner.user.phone ? ` · ${partner.user.phone}` : ""}</p>
        </Field>
        <Field label="Mã số thuế">{partner.taxCode || missing}</Field>
        <Field label="Địa chỉ kinh doanh">{partner.address || missing}</Field>
        <Field label="Ngân hàng">
          {partner.bankName || missing}
          {partner.bankAccountNumber && <p className="font-normal text-slate-500">STK {partner.bankAccountNumber}</p>}
          {partner.bankAccountHolder && <p className="font-normal text-slate-500">Chủ TK: {partner.bankAccountHolder}</p>}
        </Field>
        <Field label="Hoa hồng">
          {partner.commissionRate == null ? <span className="font-normal text-slate-500">Theo mức mặc định của hệ thống</span> : `${partner.commissionRate}% (mức riêng)`}
        </Field>
        <Field label="Ngày đăng ký">{formatDate(partner.createdAt)}</Field>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase text-slate-400">Kiểm tra hồ sơ</p>
          <ul className="mt-2 space-y-1.5">
            {(partner.checks ?? []).map((check) => <CheckItem key={check.key} check={check} />)}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-slate-400">Sân ({courts.length})</p>
          {courts.length ? (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1 text-sm">
              {courts.map((court) => (
                <li key={court.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-slate-700">{court.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {courtApprovalLabel[court.approvalStatus] ?? court.approvalStatus}
                    {court.activeStatus !== "ACTIVE" ? " · tạm ngưng" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Chưa đăng ký sân nào</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase text-slate-400">Lịch sử duyệt</p>
        <div className="mt-2 space-y-2">
          {partner.history?.length ? partner.history.map((h) => (
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
  );
}
