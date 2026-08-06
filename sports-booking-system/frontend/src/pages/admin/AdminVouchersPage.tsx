import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, ShieldCheck, ShieldOff, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { AdminReasonModal } from "./AdminReasonModal";
import { PageHero } from "../../components/common/PageHero";
import type { AdminVoucher } from "../../types/api";

const money = (value: number) => `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN");
const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

function discount(voucher: AdminVoucher) {
  return voucher.discountType === "PERCENTAGE" ? `${voucher.discountValue}%` : money(voucher.discountValue);
}

const statusTones: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  EXPIRED: "bg-amber-100 text-amber-800",
  DISABLED: "bg-red-100 text-red-800"
};

const statusLabels: Record<string, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Đang hoạt động",
  EXPIRED: "Hết hạn",
  DISABLED: "Vô hiệu hóa"
};

const statusFilterOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "DRAFT", label: "Nháp" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "EXPIRED", label: "Hết hạn" },
  { value: "DISABLED", label: "Vô hiệu hóa" }
];

function Status({ value }: { value: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTones[value] ?? statusTones.DRAFT}`}>{statusLabels[value] ?? value}</span>;
}

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
        subtitle="Quản lý voucher do Admin phát hành và voucher của các đối tác."
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
        <EmptyState title="Không có voucher phù hợp." description="Thử đổi bộ lọc hoặc tạo voucher mới." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((voucher) => (
            <article key={voucher.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                    <TicketPercent className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold">{voucher.title}</h2>
                      <Status value={voucher.status} />
                    </div>
                    <p className="mt-1 font-mono font-bold text-blue-700">{voucher.code}</p>
                  </div>
                </div>
                <p className="shrink-0 text-lg font-bold text-emerald-700">Giảm {discount(voucher)}</p>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <p>Đối tác: <strong>{voucher.businessName ?? "Toàn hệ thống (Admin)"}</strong></p>
                <p>Áp dụng: <strong>{voucher.courtName ?? "Tất cả sân"}</strong></p>
                <p>Đơn tối thiểu: <strong>{money(voucher.minBookingAmount)}</strong></p>
                <p>Thời hạn: <strong>{date(voucher.startDate)} - {date(voucher.endDate)}</strong></p>
                <p>Lượt dùng: <strong>{voucher.usedCount}/{voucher.usageLimit ?? "Không giới hạn"}</strong></p>
                <p>Ngày tạo: <strong>{dateTime(voucher.createdAt)}</strong></p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {voucher.status === "DRAFT" && (
                  <>
                    <Link to={`/admin/vouchers/${voucher.id}/edit`}><Button variant="secondary">Chỉnh sửa</Button></Link>
                    <Button onClick={() => setPending({ id: voucher.id, action: "activate" })}>
                      <ShieldCheck className="h-4 w-4" /> Kích hoạt
                    </Button>
                  </>
                )}
                {voucher.status === "ACTIVE" && (
                  <Button variant="danger" onClick={() => setPending({ id: voucher.id, action: "disable" })}>
                    <ShieldOff className="h-4 w-4" /> Vô hiệu hóa
                  </Button>
                )}
                {voucher.status === "DISABLED" && (
                  <Button onClick={() => setPending({ id: voucher.id, action: "activate" })}>
                    <ShieldCheck className="h-4 w-4" /> Kích hoạt lại
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
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
