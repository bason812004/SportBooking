import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileBarChart, Lock, Unlock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { LockAccountModal } from "../../features/admin/components/LockAccountModal";
import { useAuth } from "../../features/auth/hooks/useAuth";
import type { AdminUser } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { ErrorState, LoadingState } from "../../components/common/States";
import { SortableTh } from "../../components/common/SortableTh";
import { useDebounce } from "../../hooks/useDebounce";
import { useUrlSort } from "../../hooks/useUrlSort";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { TablePagination } from "../../components/common/TablePagination";
import { PageHero } from "../../components/common/PageHero";
import { CustomerReportPanel } from "../../features/report/components/CustomerReportPanel";
import { formatDate } from "../../lib/format";

const roleLabel: Record<string, { label: string; className: string }> = {
  USER: { label: "Khách hàng", className: "bg-sky-100 text-sky-800" },
  PARTNER: { label: "Đối tác", className: "bg-emerald-100 text-emerald-800" },
  ADMIN: { label: "Quản trị viên", className: "bg-purple-100 text-purple-800" },
  RECIPIENT: { label: "Nhân viên", className: "bg-amber-100 text-amber-800" }
};

const statusLabel: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Hoạt động", className: "bg-emerald-100 text-emerald-800" },
  LOCKED: { label: "Đã khóa", className: "bg-red-100 text-red-800" }
};

const roleFilterOptions = [
  { value: "", label: "Tất cả vai trò" },
  { value: "USER", label: "Khách hàng" },
  { value: "PARTNER", label: "Đối tác" },
  { value: "ADMIN", label: "Quản trị viên" },
  { value: "RECIPIENT", label: "Nhân viên" }
];

const statusFilterOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "LOCKED", label: "Đã khóa" }
];

type SortField = "fullName" | "email" | "role" | "status" | "createdAt";
const SORT_FIELDS: SortField[] = ["fullName", "email", "role", "status", "createdAt"];

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  // The search box only queries once the admin pauses typing.
  const debouncedSearch = useDebounce(search, 300);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [reportUserId, setReportUserId] = useState<string | null>(null);
  const [locking, setLocking] = useState<AdminUser | null>(null);
  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({ fields: SORT_FIELDS, default: null });
  const handleSort = (field: SortField) => { setPage(1); sortBy(field); };

  const users = useQuery({
    queryKey: ["admin-users", page, limit, debouncedSearch, role, status, sortField, sortOrder],
    queryFn: () => adminApi.users({ page, limit, search: debouncedSearch, role, status, sortBy: sortField ?? undefined, sortOrder }),
    placeholderData: keepPreviousData
  });

  // Locking the last account of a filtered last page can leave the current page empty.
  const totalPages = users.data?.meta.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const unlock = useMutation({
    mutationFn: (user: AdminUser) => adminApi.unlockUser(user.id),
    onSuccess: async (_result, user) => {
      toast.success(`Đã mở khóa tài khoản ${user.fullName}`);
      await refresh();
    },
    onError: (e) => toast.error(e.message)
  });

  const items = users.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Quản trị" title="Người dùng" subtitle="Quản lý tất cả tài khoản người dùng trên hệ thống." />

      <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-3">
        <Input label="Tìm tên, email, SĐT" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <Select label="Vai trò" value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} options={roleFilterOptions} />
        <Select label="Trạng thái" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} options={statusFilterOptions} />
      </div>

      {/* Loading and errors replace only the list, so the filters above always stay usable. */}
      {users.isLoading ? (
        <LoadingState />
      ) : users.isError ? (
        <ErrorState message={users.error.message} onRetry={() => users.refetch()} />
      ) : !items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
          <UserRound className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-500">Không tìm thấy người dùng phù hợp.</p>
        </div>
      ) : (
        <>
          <Table minWidth="960px">
            <THead>
              <tr>
                <SortableTh className="whitespace-nowrap" label="Người dùng" field="fullName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh className="whitespace-nowrap" label="Liên hệ" field="email" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh className="whitespace-nowrap" label="Vai trò" field="role" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh className="whitespace-nowrap" label="Trạng thái" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh className="whitespace-nowrap" label="Ngày tạo" field="createdAt" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <Th></Th>
              </tr>
            </THead>
            <TBody>
              {items.map((u) => {
                const rl = roleLabel[u.role] ?? { label: u.role, className: "bg-slate-100 text-slate-700" };
                const st = statusLabel[u.status] ?? { label: u.status, className: "bg-slate-100 text-slate-700" };
                const isMe = u.id === me?.id;
                const detail = u.role === "PARTNER" ? u.partnerProfile?.businessName : u.role === "RECIPIENT" && u.managedCourt ? `Sân: ${u.managedCourt.name}` : null;
                return (
                  <Tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                            <UserRound className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold">{u.fullName}</p>
                          {detail && <p className="text-xs text-slate-500">{detail}</p>}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-sm text-slate-600">
                      {u.email}
                      {u.phone && <p className="text-xs text-slate-500">{u.phone}</p>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rl.className}`}>{rl.label}</span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.className}`}>{st.label}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-sm text-slate-600">{formatDate(u.createdAt)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        {u.role === "USER" && (
                          <Button variant="secondary" onClick={() => setReportUserId(u.id)}>
                            <FileBarChart className="h-4 w-4" /> Xem báo cáo
                          </Button>
                        )}
                        {isMe ? (
                          <span className="text-xs font-semibold text-slate-400">Tài khoản hiện tại</span>
                        ) : u.status === "ACTIVE" ? (
                          <Button variant="danger" onClick={() => setLocking(u)}>
                            <Lock className="h-4 w-4" /> Khóa
                          </Button>
                        ) : (
                          <Button variant="secondary" disabled={unlock.isPending} onClick={() => unlock.mutate(u)}>
                            <Unlock className="h-4 w-4" /> Mở khóa
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>

          <TablePagination
            page={page}
            totalPages={users.data?.meta.totalPages ?? 1}
            total={users.data?.meta.total ?? 0}
            limit={limit}
            itemLabel="tài khoản"
            onPageChange={setPage}
            onLimitChange={(value) => {
              setPage(1);
              setLimit(value);
            }}
          />
        </>
      )}

      <LockAccountModal account={locking} onClose={() => setLocking(null)} onLocked={() => void refresh()} />

      <Modal isOpen={reportUserId != null} onClose={() => setReportUserId(null)} title="Báo cáo khách hàng" maxWidth="max-w-4xl">
        {reportUserId ? <CustomerReportPanel userId={reportUserId} /> : null}
      </Modal>
    </div>
  );
}
