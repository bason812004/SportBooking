import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, TicketPercent } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { partnerApi } from "../../features/partner/api/partnerApi";
import type { PartnerVoucher } from "../../types/api";

const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN");

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "DRAFT", label: "Nháp" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "DISABLED", label: "Đã tắt" },
  { value: "EXPIRED", label: "Hết hạn" }
];

function discount(voucher: PartnerVoucher) {
  return voucher.discountType === "PERCENTAGE"
    ? `${voucher.discountValue}%${voucher.maxDiscountAmount ? `, tối đa ${money(voucher.maxDiscountAmount)}` : ""}`
    : money(voucher.discountValue);
}

export function PartnerVouchersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const vouchers = useQuery({ queryKey: ["partner-vouchers"], queryFn: partnerApi.vouchers });
  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "activate" | "disable" | "delete" }) => {
      if (type === "activate") return partnerApi.activateVoucher(id);
      if (type === "disable") return partnerApi.disableVoucher(id);
      return partnerApi.deleteVoucher(id);
    },
    onSuccess: () => {
      toast.success("Đã cập nhật voucher");
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["partner-vouchers"] });
    },
    onError: (error) => toast.error(error.message)
  });

  const visibleVouchers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (vouchers.data ?? []).filter((voucher) => {
      if (statusFilter && voucher.status !== statusFilter) return false;
      if (!term) return true;
      return [voucher.title, voucher.code, voucher.court?.name].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [vouchers.data, search, statusFilter]);

  if (vouchers.isLoading) return <LoadingState />;
  if (vouchers.isError) return <ErrorState message={vouchers.error.message} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Voucher của đối tác</h1>
          <p className="mt-2 text-slate-600">Tạo ưu đãi cho toàn bộ hệ thống sân hoặc từng sân cụ thể.</p>
        </div>
        <Link to="/partner/vouchers/create">
          <Button><Plus className="h-4 w-4" />Tạo voucher</Button>
        </Link>
      </div>

      {!vouchers.data?.length ? (
        <EmptyState title="Bạn chưa tạo voucher nào." />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 rounded-2xl border border-line bg-white p-4">
            <Input label="Tìm kiếm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên voucher, mã, sân áp dụng" />
            <Select label="Trạng thái" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={statusOptions} />
          </div>

          {visibleVouchers.length === 0 ? (
            <EmptyState title="Không tìm thấy voucher phù hợp." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleVouchers.map((voucher) => (
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
                    <p className="text-lg font-bold text-emerald-700">Giảm {discount(voucher)}</p>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <p>Áp dụng: <strong>{voucher.court?.name ?? "Tất cả sân"}</strong></p>
                    <p>Đơn tối thiểu: <strong>{money(voucher.minBookingAmount)}</strong></p>
                    <p>Thời hạn: <strong>{date(voucher.startDate)} - {date(voucher.endDate)}</strong></p>
                    <p>Lượt dùng: <strong>{voucher.usedCount}/{voucher.usageLimit ?? "Không giới hạn"}</strong></p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {voucher.status === "DRAFT" && (
                      <>
                        <Link to={`/partner/vouchers/${voucher.id}/edit`}><Button variant="secondary">Chỉnh sửa</Button></Link>
                        <Button onClick={() => action.mutate({ id: voucher.id, type: "activate" })}>Kích hoạt</Button>
                        <Button variant="danger" onClick={() => setDeleteConfirm(voucher.id)}>
                          Xóa
                        </Button>
                      </>
                    )}
                    {voucher.status === "ACTIVE" && (
                      <Button variant="secondary" onClick={() => action.mutate({ id: voucher.id, type: "disable" })}>
                        Vô hiệu hóa
                      </Button>
                    )}
                    {voucher.status === "DISABLED" && (
                      <Button onClick={() => action.mutate({ id: voucher.id, type: "activate" })}>Kích hoạt lại</Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={Boolean(deleteConfirm)}
        title="Xác nhận xóa voucher"
        message="Voucher nháp này sẽ bị xóa vĩnh viễn và không thể khôi phục."
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && action.mutate({ id: deleteConfirm, type: "delete" })}
      />
    </div>
  );
}

function Status({ value }: { value: string }) {
  const tones: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    ACTIVE: "bg-emerald-100 text-emerald-800",
    DISABLED: "bg-amber-100 text-amber-800",
    EXPIRED: "bg-red-100 text-red-700"
  };
  const labels: Record<string, string> = {
    DRAFT: "Nháp",
    ACTIVE: "Đang hoạt động",
    DISABLED: "Đã tắt",
    EXPIRED: "Hết hạn"
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[value] ?? tones.DRAFT}`}>{labels[value] ?? value}</span>;
}
