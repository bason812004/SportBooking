import { Fragment, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ChevronRight, Link2, ShieldAlert, ShieldCheck } from "lucide-react";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState, EmptyState } from "../../components/common/States";
import { SortableTh } from "../../components/common/SortableTh";
import { TablePagination } from "../../components/common/TablePagination";
import { useDebounce } from "../../hooks/useDebounce";
import { useUrlSort } from "../../hooks/useUrlSort";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { PageHero } from "../../components/common/PageHero";
import { formatDateTime } from "../../lib/format";
import type { AuditLog } from "../../types/api";
import { ROLE_LABELS, actionLabel, actionTone, entityLabel, metadataLabel, metadataValue } from "./auditLabels";

const short = (value?: string | null) => (value ? `${value.slice(0, 10)}…` : "—");

type SortField = "action" | "entityType" | "actorName" | "createdAt";
const SORT_FIELDS: SortField[] = ["action", "entityType", "actorName", "createdAt"];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

export function AdminAuditLogsPage() {
  // ?search= arrives from the blockchain queue (an entry's id).
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [filters, setFilters] = useState({ action: "", entityType: "", actorRole: "", fromDate: "", toDate: "" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({ fields: SORT_FIELDS, default: null });
  const handleSort = (field: SortField) => { setPage(1); sortBy(field); };
  const setFilter = (key: keyof typeof filters, value: string) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };

  const q = useQuery({
    queryKey: ["admin-audit", debouncedSearch, filters, page, limit, sortField, sortOrder],
    queryFn: () => adminApi.auditLogs({ search: debouncedSearch, ...filters, page, limit, sortBy: sortField ?? undefined, sortOrder }),
    placeholderData: keepPreviousData
  });
  const options = useQuery({ queryKey: ["admin-audit-filter-options"], queryFn: adminApi.auditLogFilterOptions, staleTime: 5 * 60_000 });

  const verify = useMutation({
    mutationFn: adminApi.verifyAuditLogs,
    onSuccess: (result) =>
      result.valid
        ? toast.success(`Chuỗi hợp lệ: ${result.checked} bản ghi`)
        : toast.error(result.headMismatch ? "Cuối chuỗi không khớp đầu chuỗi đã lưu" : `Chuỗi bị gián đoạn ở bản ghi thứ ${result.checked}`),
    onError: (error) => toast.error(error.message)
  });

  const items = q.data?.items ?? [];
  const filtered = Boolean(debouncedSearch || Object.values(filters).some(Boolean));
  const showEntry = (id: string) => {
    setFilters({ action: "", entityType: "", actorRole: "", fromDate: "", toDate: "" });
    setPage(1);
    setSearch(id);
    setExpanded(id);
  };

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Bảo mật"
        title="Nhật ký kiểm toán"
        subtitle="Mỗi thao tác quản trị và tài chính được ghi nối tiếp thành chuỗi hash. Cơ sở dữ liệu chặn sửa, xoá bản ghi; nút xác minh tính lại toàn bộ chuỗi để phát hiện thay đổi."
        actions={
          <Button className="bg-white/20 text-white ring-1 ring-white/30 hover:bg-white/30" disabled={verify.isPending} onClick={() => verify.mutate()}>
            <CheckCircle2 className="h-4 w-4" />
            {verify.isPending ? "Đang xác minh..." : "Xác minh chuỗi"}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
          <span className="rounded-xl bg-slate-100 p-3 text-slate-600">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm text-slate-500">{filtered ? "Bản ghi phù hợp bộ lọc" : "Tổng số bản ghi"}</p>
            <p className="text-xl font-bold">{q.data?.meta.total ?? "—"}</p>
          </div>
        </div>
        {verify.data && (
          <div className={`flex items-center gap-3 rounded-2xl border p-4 ${verify.data.valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <span className={`rounded-xl p-3 ${verify.data.valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {verify.data.valid ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-bold ${verify.data.valid ? "text-emerald-800" : "text-red-800"}`}>
                {verify.data.valid ? "Chuỗi hash hợp lệ" : "Phát hiện gián đoạn chuỗi"}
              </p>
              <p className="text-xs text-slate-500">
                {verify.data.valid
                  ? `Đã kiểm tra ${verify.data.checked} bản ghi`
                  : verify.data.headMismatch
                    ? `${verify.data.checked} bản ghi nối đúng, nhưng bản ghi cuối không khớp đầu chuỗi đã lưu: có thể bản ghi mới nhất đã bị xoá.`
                    : `Bản ghi thứ ${verify.data.checked} không khớp hash hoặc không nối với bản ghi trước.`}
              </p>
              {!verify.data.valid && verify.data.brokenAt && (
                <button className="mt-1 text-xs font-semibold text-red-700 hover:underline" onClick={() => showEntry(verify.data!.brokenAt!)}>
                  Xem bản ghi
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
        <Input
          label="Tìm kiếm"
          value={search}
          placeholder="Mã bản ghi, đối tượng, người thực hiện"
          onChange={(event) => { setPage(1); setSearch(event.target.value); }}
        />
        <Select
          label="Hành động"
          value={filters.action}
          onChange={(event) => setFilter("action", event.target.value)}
          options={[{ value: "", label: "Tất cả hành động" }, ...(options.data?.actions ?? []).map((value) => ({ value, label: actionLabel(value) }))]}
        />
        <Select
          label="Đối tượng"
          value={filters.entityType}
          onChange={(event) => setFilter("entityType", event.target.value)}
          options={[{ value: "", label: "Tất cả đối tượng" }, ...(options.data?.entityTypes ?? []).map((value) => ({ value, label: entityLabel(value) }))]}
        />
        <Select
          label="Người thực hiện"
          value={filters.actorRole}
          onChange={(event) => setFilter("actorRole", event.target.value)}
          options={[{ value: "", label: "Tất cả" }, ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))]}
        />
        <Input label="Từ ngày" type="date" value={filters.fromDate} max={filters.toDate || undefined} onChange={(event) => setFilter("fromDate", event.target.value)} />
        <Input label="Đến ngày" type="date" value={filters.toDate} min={filters.fromDate || undefined} onChange={(event) => setFilter("toDate", event.target.value)} />
      </div>

      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : !items.length ? (
        <EmptyState
          title={filtered ? "Không có bản ghi phù hợp." : "Chưa có nhật ký nào."}
          description={filtered ? undefined : "Các thao tác quản trị sẽ được ghi lại tại đây."}
        />
      ) : (
        <>
          <Table minWidth="1080px">
            <THead>
              <tr>
                <SortableTh label="Thời gian" field="createdAt" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Hành động" field="action" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Người thực hiện" field="actorName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Đối tượng" field="entityType" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <Th>Hash</Th>
                <Th className="text-right">Chi tiết</Th>
              </tr>
            </THead>
            <TBody>
              {items.map((log) => (
                <Fragment key={log.id}>
                  <Tr>
                    <Td className="whitespace-nowrap">{formatDateTime(log.createdAt)}</Td>
                    <Td>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${actionTone(log.action)}`}>{actionLabel(log.action)}</span>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">{log.action}</p>
                    </Td>
                    <Td><Actor log={log} /></Td>
                    <Td>
                      {entityLabel(log.entityType)}
                      <br />
                      <span className="text-xs text-slate-500">{log.entityId}</span>
                    </Td>
                    <Td>
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600" title={log.currentHash}>
                        {short(log.currentHash)}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <Button variant="secondary" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                        {expanded === log.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {expanded === log.id ? "Thu gọn" : "Xem"}
                      </Button>
                    </Td>
                  </Tr>
                  {expanded === log.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-4 pb-4 pt-1">
                        <EntryDetail log={log} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </TBody>
          </Table>
          <TablePagination
            page={page}
            totalPages={q.data?.meta.totalPages ?? 1}
            total={q.data?.meta.total ?? 0}
            limit={limit}
            itemLabel="bản ghi"
            onPageChange={setPage}
            onLimitChange={(value) => { setPage(1); setLimit(value); }}
          />
        </>
      )}
    </div>
  );
}

function Actor({ log }: { log: AuditLog }) {
  if (!log.actor) {
    return <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">Hệ thống</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
        {initials(log.actor.fullName)}
      </span>
      <div className="min-w-0">
        <p className="font-medium">
          {log.actor.fullName}
          <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{ROLE_LABELS[log.actor.role] ?? log.actor.role}</span>
        </p>
        <p className="text-xs text-slate-500">{log.actor.email}</p>
      </div>
    </div>
  );
}

function EntryDetail({ log }: { log: AuditLog }) {
  const entries = log.metadata && typeof log.metadata === "object" ? Object.entries(log.metadata) : [];
  return (
    <div className="grid gap-4 rounded-xl border border-line bg-white p-4 text-sm md:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Nội dung</p>
        {entries.length ? (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
            {entries.map(([key, value]) => (
              <Fragment key={key}>
                <dt className="text-slate-500">{metadataLabel(key)}</dt>
                <dd className="break-words font-medium text-ink">{metadataValue(key, value)}</dd>
              </Fragment>
            ))}
          </dl>
        ) : (
          <p className="text-slate-500">Không có thông tin thêm.</p>
        )}
      </div>
      <div className="space-y-1 font-mono text-xs text-slate-600">
        <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-slate-500">Chuỗi hash</p>
        <p><span className="text-slate-400">Mã bản ghi:</span> {log.id}</p>
        <p className="break-all"><span className="text-slate-400">Hash trước:</span> {log.previousHash ?? "— (bản ghi đầu tiên)"}</p>
        <p className="break-all"><span className="text-slate-400">Hash hiện tại:</span> {log.currentHash}</p>
      </div>
    </div>
  );
}
