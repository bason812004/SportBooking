import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Link2, ShieldAlert, ShieldCheck } from "lucide-react";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ErrorState, LoadingState, EmptyState } from "../../components/common/States";
import { SortableTh } from "../../components/common/SortableTh";
import { useUrlSort } from "../../hooks/useUrlSort";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { PageHero } from "../../components/common/PageHero";

const short = (value?: string | null) => (value ? `${value.slice(0, 10)}…` : "-");

type SortField = "action" | "entityType" | "actorName" | "createdAt";
const SORT_FIELDS: SortField[] = ["action", "entityType", "actorName", "createdAt"];

function actionTone(action: string) {
  const value = action.toUpperCase();
  if (value.includes("REJECT") || value.includes("DISABLE") || value.includes("DELETE") || value.includes("LOCK") || value.includes("BAN")) {
    return "bg-red-100 text-red-700";
  }
  if (value.includes("APPROVE") || value.includes("CREATE") || value.includes("ACTIVE") || value.includes("UNLOCK") || value.includes("RESOLVE")) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (value.includes("UPDATE") || value.includes("EDIT")) {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-slate-100 text-slate-700";
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

export function AdminAuditLogsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({ fields: SORT_FIELDS, default: null });
  const handleSort = (field: SortField) => { setPage(1); sortBy(field); };

  const q = useQuery({
    queryKey: ["admin-audit", search, page, sortField, sortOrder],
    queryFn: () => adminApi.auditLogs({ search, page, limit: 10, sortBy: sortField ?? undefined, sortOrder }),
    placeholderData: keepPreviousData
  });

  const verify = useMutation({
    mutationFn: adminApi.verifyAuditLogs,
    onSuccess: (result) => (result.valid ? toast.success(`Chuỗi hợp lệ: ${result.checked} bản ghi`) : toast.error(`Chuỗi bị lỗi tại ${result.brokenAt}`)),
    onError: (error) => toast.error(error.message)
  });

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} />;

  const items = q.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Bảo mật"
        title="Nhật ký kiểm toán"
        subtitle="Chuỗi hash append-only ghi lại mọi thao tác quản trị, không thể sửa hoặc xóa sau khi ghi."
        actions={
          <Button className="bg-white/20 text-white ring-1 ring-white/30 hover:bg-white/30" disabled={verify.isPending} onClick={() => verify.mutate()}>
            <CheckCircle2 className="h-4 w-4" />
            Xác minh chuỗi
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
          <span className="rounded-xl bg-slate-100 p-3 text-slate-600">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm text-slate-500">Tổng số bản ghi</p>
            <p className="text-xl font-bold">{q.data?.meta.total ?? 0}</p>
          </div>
        </div>
        {verify.data && (
          <div className={`flex items-center gap-3 rounded-2xl border p-4 ${verify.data.valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <span className={`rounded-xl p-3 ${verify.data.valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {verify.data.valid ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </span>
            <div>
              <p className={`text-sm font-bold ${verify.data.valid ? "text-emerald-800" : "text-red-800"}`}>
                {verify.data.valid ? "Chuỗi hash hợp lệ" : "Phát hiện gián đoạn chuỗi"}
              </p>
              <p className="text-xs text-slate-500">
                {verify.data.valid ? `Đã kiểm tra ${verify.data.checked} bản ghi` : `Lỗi tại bản ghi ${verify.data.brokenAt}`}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <Input label="Tìm action, actor, entity" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} />
      </div>

      {!items.length ? (
        <EmptyState title="Chưa có nhật ký nào." description="Các thao tác quản trị sẽ được ghi lại tại đây." />
      ) : (
        <Table minWidth="1000px">
          <THead>
            <tr>
              <SortableTh label="Hành động" field="action" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <SortableTh label="Admin" field="actorName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <SortableTh label="Đối tượng" field="entityType" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <Th>Hash trước</Th>
              <Th>Hash hiện tại</Th>
              <SortableTh label="Thời gian" field="createdAt" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            </tr>
          </THead>
          <TBody>
            {items.map((log) => (
              <Tr key={log.id}>
                <Td>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${actionTone(log.action)}`}>{log.action}</span>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                      {initials(log.actor.fullName)}
                    </span>
                    <div>
                      <p className="font-medium">{log.actor.fullName}</p>
                      <p className="text-xs text-slate-500">{log.actor.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  {log.entityType}
                  <br />
                  <span className="text-xs text-slate-500">{log.entityId}</span>
                </Td>
                <Td>
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">{short(log.previousHash)}</span>
                </Td>
                <Td>
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">{short(log.currentHash)}</span>
                </Td>
                <Td>{new Date(log.createdAt).toLocaleString("vi-VN")}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <Pager page={page} total={q.data?.meta.totalPages ?? 1} setPage={setPage} />
    </div>
  );
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (value: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex justify-end gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
      <span className="py-2 text-sm font-semibold">{page}/{Math.max(total, 1)}</span>
      <Button variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)}>Sau</Button>
    </div>
  );
}
