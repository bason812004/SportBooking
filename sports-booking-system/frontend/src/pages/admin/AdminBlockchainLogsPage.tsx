import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { adminApi } from "../../features/admin/api/adminApi";
import { Input } from "../../components/ui/Input";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { SortableTh } from "../../components/common/SortableTh";
import { TablePagination } from "../../components/common/TablePagination";
import { useDebounce } from "../../hooks/useDebounce";
import { useUrlSort } from "../../hooks/useUrlSort";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { PageHero } from "../../components/common/PageHero";
import { formatDateTime } from "../../lib/format";
import { actionLabel, entityLabel } from "./auditLabels";

type SortField = "createdAt" | "entityType";
const SORT_FIELDS: SortField[] = ["createdAt", "entityType"];

const statusLabels: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Chờ neo", tone: "bg-amber-100 text-amber-800" },
  CONFIRMED: { label: "Đã neo", tone: "bg-emerald-100 text-emerald-800" },
  FAILED: { label: "Lỗi", tone: "bg-red-100 text-red-700" }
};
const networkLabel = (network: string) => (network === "NOT_CONFIGURED" ? "Chưa cấu hình" : network);

export function AdminBlockchainLogsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({ fields: SORT_FIELDS, default: null });
  const handleSort = (field: SortField) => { setPage(1); sortBy(field); };

  const q = useQuery({
    queryKey: ["admin-ledger", debouncedSearch, page, limit, sortField, sortOrder],
    queryFn: () => adminApi.blockchainLogs({ search: debouncedSearch, page, limit, sortBy: sortField ?? undefined, sortOrder }),
    placeholderData: keepPreviousData
  });
  const items = q.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Bảo mật"
        title="Nhật ký blockchain"
        subtitle="Hàng đợi neo mã hash của nhật ký kiểm toán lên blockchain, để chứng minh với bên ngoài rằng nhật ký không bị viết lại."
      />

      <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">Chưa cấu hình nhà cung cấp blockchain.</p>
          <p>
            Mỗi bản ghi nhật ký kiểm toán được xếp vào hàng đợi này với mã hash của nó, nhưng chưa bản ghi nào được đưa lên chuỗi: trạng thái “Chờ neo” là
            thật, không có giao dịch on-chain nào được giả lập. Trong lúc chờ, tính toàn vẹn được đảm bảo bởi chuỗi hash và việc cơ sở dữ liệu chặn sửa,
            xoá nhật ký (xem Nhật ký kiểm toán).
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4 md:max-w-md">
        <Input
          label="Tìm kiếm"
          value={search}
          placeholder="Hành động, đối tượng, mã hash, mã bản ghi"
          onChange={(event) => { setPage(1); setSearch(event.target.value); }}
        />
      </div>

      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : !items.length ? (
        <EmptyState title={debouncedSearch ? "Không có bản ghi phù hợp." : "Hàng đợi trống."} />
      ) : (
        <>
          <Table minWidth="980px">
            <THead>
              <tr>
                <SortableTh label="Thời gian" field="createdAt" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <Th>Bản ghi kiểm toán</Th>
                <SortableTh label="Đối tượng" field="entityType" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <Th>Mã hash</Th>
                <Th>Mạng</Th>
                <Th>Trạng thái</Th>
              </tr>
            </THead>
            <TBody>
              {items.map((item) => {
                const status = statusLabels[item.status] ?? { label: item.status, tone: "bg-slate-100 text-slate-700" };
                return (
                  <Tr key={item.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(item.createdAt)}</Td>
                    <Td>
                      {item.audit ? (
                        <>
                          <Link className="font-semibold text-action hover:underline" to={`/admin/audit-logs?search=${item.audit.id}`}>
                            {actionLabel(item.audit.action)}
                          </Link>
                          <p className="text-xs text-slate-500">{item.audit.actor?.fullName ?? "Hệ thống"}</p>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      {entityLabel(item.entityType)}
                      <br />
                      <span className="text-xs text-slate-500">{item.entityId}</span>
                    </Td>
                    <Td>
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600" title={item.payloadHash}>
                        {item.payloadHash.slice(0, 14)}…
                      </span>
                      {item.txHash && <p className="mt-1 break-all font-mono text-xs text-slate-500">tx {item.txHash}</p>}
                    </Td>
                    <Td>{networkLabel(item.network)}</Td>
                    <Td>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status.tone}`}>{status.label}</span>
                    </Td>
                  </Tr>
                );
              })}
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
