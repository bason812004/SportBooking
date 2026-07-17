import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Gift, Plus, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { AdminReasonModal } from "./AdminReasonModal";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { PageHero } from "../../components/common/PageHero";

const statusLabel: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Nháp", className: "bg-slate-100 text-slate-700" },
  ACTIVE: { label: "Đang hoạt động", className: "bg-emerald-100 text-emerald-800" },
  EXPIRED: { label: "Hết hạn", className: "bg-amber-100 text-amber-800" },
  DISABLED: { label: "Vô hiệu hóa", className: "bg-red-100 text-red-800" }
};

const statusFilterOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "DRAFT", label: "Nháp" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "EXPIRED", label: "Hết hạn" },
  { value: "DISABLED", label: "Vô hiệu hóa" }
];

export function AdminVouchersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ id: string; action: "activate" | "disable" } | null>(null);

  const q = useQuery({
    queryKey: ["admin-vouchers", search, status, page],
    queryFn: () => adminApi.vouchers({ search, status, page, limit: 10 }),
    placeholderData: keepPreviousData
  });

  const action = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "activate" | "disable"; reason: string }) =>
      adminApi.setVoucherStatus(id, action, reason),
    onSuccess: async () => {
      toast.success("Đã cập nhật voucher");
      setPending(null);
      await qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
    onError: (e) => toast.error(e.message)
  });

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} />;

  const items = q.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Nội dung"
        title="Voucher toàn hệ thống"
        subtitle="Quản lý tất cả voucher của đối tác trên hệ thống."
        actions={
          <Link to="/admin/vouchers/create">
            <Button className="bg-white/20 text-white ring-1 ring-white/30 hover:bg-white/30">
              <Plus className="h-4 w-4" /> Tạo voucher
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2">
        <Input
          label="Tìm mã, tiêu đề, đối tác"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
        />
        <Select
          label="Trạng thái"
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          options={statusFilterOptions}
        />
      </div>

      {!items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
          <Gift className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-500">Không có voucher phù hợp.</p>
        </div>
      ) : (
        <Table minWidth="900px">
          <THead>
            <tr>
              <Th>Mã</Th>
              <Th>Voucher</Th>
              <Th>Đối tác</Th>
              <Th>Giảm giá</Th>
              <Th>Đã dùng</Th>
              <Th>Trạng thái</Th>
              <Th></Th>
            </tr>
          </THead>
          <TBody>
            {items.map((v: any) => {
              const st = statusLabel[v.status] ?? { label: v.status, className: "bg-slate-100 text-slate-700" };
              return (
                <Tr key={v.id}>
                  <Td className="font-bold font-mono text-sm">{v.code}</Td>
                  <Td>
                    <p className="font-bold">{v.title}</p>
                    {v.description && <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{v.description}</p>}
                  </Td>
                  <Td>
                    <p className="font-semibold">{v.businessName}</p>
                    <span className="text-xs text-slate-500">{v.courtName || "Tất cả sân"}</span>
                  </Td>
                  <Td className="font-semibold">
                    {v.discountType === "PERCENTAGE" ? `${v.discountValue}%` : `${Number(v.discountValue).toLocaleString("vi-VN")}đ`}
                  </Td>
                  <Td className="font-semibold">{v.usedCount}/{v.usageLimit ?? "∞"}</Td>
                  <Td>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${st.className}`}>
                      {st.label}
                    </span>
                  </Td>
                  <Td>
                    {(v.status === "ACTIVE" || v.status === "DISABLED") && (
                      <Button
                        variant={v.status === "ACTIVE" ? "danger" : "secondary"}
                        onClick={() => setPending({ id: v.id, action: v.status === "ACTIVE" ? "disable" : "activate" })}
                      >
                        {v.status === "ACTIVE" ? (
                          <><ShieldOff className="h-4 w-4" /> Vô hiệu hóa</>
                        ) : (
                          <><ShieldCheck className="h-4 w-4" /> Kích hoạt</>
                        )}
                      </Button>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      <Pager page={page} total={q.data?.meta?.totalPages ?? 1} setPage={setPage} />

      <AdminReasonModal
        open={Boolean(pending)}
        title={pending?.action === "activate" ? "Kích hoạt voucher" : "Vô hiệu hóa voucher"}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && action.mutate({ ...pending, reason })}
      />
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
