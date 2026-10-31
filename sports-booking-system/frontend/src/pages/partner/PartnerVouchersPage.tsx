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
import { describeVoucherConditions } from "../../components/voucher/VoucherConditionsFields";
import {
  voucherActivationBlocker,
  VoucherLockedBadge,
  VoucherStatusBadge,
  voucherStatusOptions
} from "../../components/voucher/VoucherStatusBadge";
import { partnerApi } from "../../features/partner/api/partnerApi";
import type { PartnerVoucher } from "../../types/api";

const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN");
const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

function discount(voucher: PartnerVoucher) {
  return voucher.discountType === "PERCENTAGE"
    ? `${voucher.discountValue}%${voucher.maxDiscountAmount ? `, tối đa ${money(voucher.maxDiscountAmount)}` : ""}`
    : money(voucher.discountValue);
}

type VoucherAction = "activate" | "disable" | "delete";

const actionMessages: Record<VoucherAction, (code: string) => string> = {
  activate: (code) => `Đã kích hoạt voucher ${code}`,
  disable: (code) => `Đã tắt voucher ${code}`,
  delete: (code) => `Đã xóa voucher ${code}`
};

/** Disabling and deleting are asked again: one stops a code customers may be using, the other cannot be undone. */
const confirmCopy: Record<"disable" | "delete", { title: string; message: string }> = {
  disable: {
    title: "Tắt voucher",
    message: "Khách hàng sẽ không dùng được mã này nữa cho đến khi bạn kích hoạt lại. Các đơn đã đặt vẫn giữ ưu đãi."
  },
  delete: { title: "Xác nhận xóa voucher", message: "Voucher nháp này sẽ bị xóa vĩnh viễn và không thể khôi phục." }
};

export function PartnerVouchersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirm, setConfirm] = useState<{ voucher: PartnerVoucher; type: "disable" | "delete" } | null>(null);
  const vouchers = useQuery({ queryKey: ["partner-vouchers"], queryFn: partnerApi.vouchers });
  const action = useMutation({
    mutationFn: ({ voucher, type }: { voucher: PartnerVoucher; type: VoucherAction }) => {
      if (type === "activate") return partnerApi.activateVoucher(voucher.id);
      if (type === "disable") return partnerApi.disableVoucher(voucher.id);
      return partnerApi.deleteVoucher(voucher.id);
    },
    onSuccess: (_result, { voucher, type }) => {
      toast.success(actionMessages[type](voucher.code));
      setConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["partner-vouchers"] });
    },
    // A conflict means the voucher changed meanwhile (e.g. an admin disabled it): show what it is now.
    onError: (error) => {
      toast.error(error.message);
      queryClient.invalidateQueries({ queryKey: ["partner-vouchers"] });
    }
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
            <Select label="Trạng thái" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={voucherStatusOptions} />
          </div>

          {visibleVouchers.length === 0 ? (
            <EmptyState title="Không tìm thấy voucher phù hợp." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleVouchers.map((voucher) => {
                const locked = Boolean(voucher.lockedByAdmin) && voucher.status === "DISABLED";
                const canTurnOn = voucher.status === "DRAFT" || (voucher.status === "DISABLED" && !locked);
                const blocker = canTurnOn ? voucherActivationBlocker(voucher) : null;
                return (
                  <article key={voucher.id} className="rounded-2xl border border-line bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                          <TicketPercent className="h-6 w-6" />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-bold">{voucher.title}</h2>
                            <VoucherStatusBadge status={voucher.status} />
                            {locked && <VoucherLockedBadge />}
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
                      <p>Ngày tạo: <strong>{dateTime(voucher.createdAt)}</strong></p>
                      <p className="sm:col-span-2">Điều kiện: <strong>{describeVoucherConditions(voucher) ?? "Mọi ngày, mọi khung giờ"}</strong></p>
                    </div>

                    {locked && (
                      <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                        Quản trị viên đã tạm ngưng voucher này{voucher.lockReason ? `. Lý do: ${voucher.lockReason.replace(/[.\s]+$/, "")}` : ""}. Liên hệ
                        quản trị viên để được kích hoạt lại.
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {/* An activated voucher can still change its wording, end date and usage limit. */}
                      <Link to={`/partner/vouchers/${voucher.id}/edit`}>
                        <Button variant="secondary">{voucher.status === "EXPIRED" || blocker ? "Gia hạn / chỉnh sửa" : "Chỉnh sửa"}</Button>
                      </Link>
                      {canTurnOn && !blocker && (
                        <Button disabled={action.isPending} onClick={() => action.mutate({ voucher, type: "activate" })}>
                          {voucher.status === "DRAFT" ? "Kích hoạt" : "Kích hoạt lại"}
                        </Button>
                      )}
                      {voucher.status === "DRAFT" && (
                        <Button variant="danger" disabled={action.isPending} onClick={() => setConfirm({ voucher, type: "delete" })}>
                          Xóa
                        </Button>
                      )}
                      {voucher.status === "ACTIVE" && (
                        <Button variant="secondary" disabled={action.isPending} onClick={() => setConfirm({ voucher, type: "disable" })}>
                          Vô hiệu hóa
                        </Button>
                      )}
                      {blocker && <span className="text-xs text-slate-500">{blocker}</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm ? `${confirmCopy[confirm.type].title} ${confirm.voucher.code}` : ""}
        message={confirm ? confirmCopy[confirm.type].message : ""}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && !action.isPending && action.mutate(confirm)}
      />
    </div>
  );
}
