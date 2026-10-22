import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileBarChart, Lock, ShieldCheck, Unlock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { ErrorState, LoadingState } from "../../components/common/States";
import { SortableTh } from "../../components/common/SortableTh";
import { useUrlSort } from "../../hooks/useUrlSort";
import { Table, THead, TBody, Tr, Td } from "../../components/common/Table";
import { PageHero } from "../../components/common/PageHero";
import { CustomerReportPanel } from "../../features/report/components/CustomerReportPanel";

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

type SortField = "fullName" | "email" | "role" | "status";
const SORT_FIELDS: SortField[] = ["fullName", "email", "role", "status"];

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [reportUserId, setReportUserId] = useState<string | null>(null);
  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({ fields: SORT_FIELDS, default: null });
  const handleSort = (field: SortField) => { setPage(1); sortBy(field); };

  const users = useQuery({
    queryKey: ["admin-users", page, search, role, status, sortField, sortOrder],
    queryFn: () => adminApi.users({ page, limit: 10, search, role, status, sortBy: sortField ?? undefined, sortOrder }),
    placeholderData: keepPreviousData
  });

  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      status === "ACTIVE" ? adminApi.lockUser(id) : adminApi.unlockUser(id),
    onSuccess: async () => {
      toast.success("Đã cập nhật tài khoản");
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e.message)
  });

  if (users.isLoading) return <LoadingState />;
  if (users.isError) return <ErrorState message={users.error.message} />;

  const items = users.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Quản trị" title="Người dùng" subtitle="Quản lý tất cả tài khoản người dùng trên hệ thống." />

      <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-3">
        <Input label="Tìm tên, email" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <Select label="Vai trò" value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} options={roleFilterOptions} />
        <Select label="Trạng thái" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} options={statusFilterOptions} />
      </div>

      {!items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
          <UserRound className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-500">Không tìm thấy người dùng phù hợp.</p>
        </div>
      ) : (
        <Table minWidth="800px">
          <THead>
            <tr>
              <SortableTh label="Người dùng" field="fullName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <SortableTh label="Email" field="email" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <SortableTh label="Vai trò" field="role" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <SortableTh label="Trạng thái" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              <th></th>
            </tr>
          </THead>
          <TBody>
            {items.map((u: any) => {
              const rl = roleLabel[u.role] ?? { label: u.role, className: "bg-slate-100 text-slate-700" };
              const st = statusLabel[u.status] ?? { label: u.status, className: "bg-slate-100 text-slate-700" };
              const isMe = u.id === me?.id;
              return (
                <Tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                          <UserRound className="h-4 w-4 text-slate-400" />
                        </div>
                      )}
                      <span className="font-semibold">{u.fullName}</span>
                    </div>
                  </Td>
                  <Td className="text-sm text-slate-600">{u.email}</Td>
                  <Td>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rl.className}`}>{rl.label}</span>
                  </Td>
                  <Td>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.className}`}>{st.label}</span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      {u.role === "USER" && (
                        <Button variant="secondary" onClick={() => setReportUserId(u.id)}>
                          <FileBarChart className="h-4 w-4" /> Xem báo cáo
                        </Button>
                      )}
                      {isMe ? (
                        <span className="text-xs font-semibold text-slate-400">Tài khoản hiện tại</span>
                      ) : (
                        <Button
                          variant={u.status === "ACTIVE" ? "danger" : "secondary"}
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate({ id: u.id, status: u.status })}
                        >
                          {u.status === "ACTIVE" ? (
                            <><Lock className="h-4 w-4" /> Khóa</>
                          ) : (
                            <><Unlock className="h-4 w-4" /> Mở khóa</>
                          )}
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      <Pager page={page} total={users.data?.meta?.totalPages ?? 1} setPage={setPage} />

      <Modal isOpen={reportUserId != null} onClose={() => setReportUserId(null)} title="Báo cáo khách hàng" maxWidth="max-w-4xl">
        {reportUserId ? <CustomerReportPanel userId={reportUserId} /> : null}
      </Modal>
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
