import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Eye, Pencil, Plus, ShieldCheck, ShieldOff, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { TablePagination } from "../../components/common/TablePagination";
import { describeVoucherConditions } from "../../components/voucher/VoucherConditionsFields";
import {
  voucherActivationBlocker,
  voucherFundingLabels,
  VoucherLockedBadge,
  VoucherStatusBadge,
  voucherStatusOptions
} from "../../components/voucher/VoucherStatusBadge";
import { ReasonModal } from "../../components/common/ReasonModal";
import { PageHero } from "../../components/common/PageHero";
import { useDebounce } from "../../hooks/useDebounce";
import type { AdminVoucher } from "../../types/api";

const money = (value: number) => `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN");
const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

function discount(voucher: AdminVoucher) {
  return voucher.discountType === "PERCENTAGE"
    ? `${voucher.discountValue}%${voucher.maxDiscountAmount ? `, tối đa ${money(voucher.maxDiscountAmount)}` : ""}`
    : money(voucher.discountValue);
}

type PendingAction = { voucher: AdminVoucher; action: "activate" | "disable" };

/**
 * What an admin may do, matching the backend: platform vouchers are fully theirs; a partner's voucher can only be
 * disabled while it runs and turned back on when an admin was the one who disabled it. A voucher past its end date
 * or out of uses cannot be turned on until that is changed, so the hint replaces the button.
 */
function voucherActions(voucher: AdminVoucher) {
  if (!voucher.partnerId) {
    const canTurnOn = voucher.status === "DRAFT" || voucher.status === "DISABLED";
    const blocker = canTurnOn ? voucherActivationBlocker(voucher) : null;
    return {
      edit: true,
      activate: canTurnOn && !blocker,
      disable: voucher.status === "ACTIVE",
      note: blocker ?? (voucher.status === "EXPIRED" ? "Gia hạn ngày kết thúc để voucher chạy lại." : null)
    };
  }
  const canTurnOn = voucher.status === "DISABLED" && voucher.lockedByAdmin;
  const blocker = canTurnOn ? voucherActivationBlocker(voucher) : null;
  return {
    edit: false,
    activate: canTurnOn && !blocker,
    disable: voucher.status === "ACTIVE",
    note: blocker
      ? `${blocker} Đối tác tự gia hạn hoặc tăng lượt.`
      : voucher.status === "DRAFT"
        ? "Bản nháp của đối tác, đối tác tự kích hoạt."
        : voucher.status === "DISABLED" && !voucher.lockedByAdmin
          ? "Đối tác tự tắt voucher này."
          : null
  };
}

export function AdminVouchersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  // The search box only queries once the admin pauses typing.
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const q = useQuery({
    queryKey: ["admin-vouchers", debouncedSearch, status, page, limit],
    queryFn: () => adminApi.vouchers({ search: debouncedSearch, status, page, limit }),
    placeholderData: keepPreviousData
  });

  // Disabling the last voucher of a filtered last page can leave the current page empty.
  const totalPages = q.data?.meta?.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const action = useMutation({
    mutationFn: ({ voucher, action, reason }: PendingAction & { reason: string }) =>
      adminApi.setVoucherStatus(voucher.id, action, reason || undefined),
    onSuccess: async (_result, { voucher, action }) => {
      toast.success(
        action === "disable"
          ? `Đã vô hiệu hóa voucher ${voucher.code}${voucher.partnerId ? ", đối tác đã được thông báo" : ""}`
          : `Đã kích hoạt voucher ${voucher.code}${voucher.partnerId ? ", đối tác đã được thông báo" : ""}`
      );
      setPending(null);
      await qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
    onError: (e) => toast.error(e.message)
  });

  const items = q.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Nội dung"
        title="Voucher toàn hệ thống"
        subtitle="Quản lý voucher do Admin phát hành và kiểm duyệt voucher của các đối tác."
        actions={
          <Link to="/admin/vouchers/create">
            <Button>
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
          options={voucherStatusOptions}
        />
      </div>

      {/* Loading and errors replace only the list, so the filters above always stay usable. */}
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : !items.length ? (
        <EmptyState title="Không có voucher phù hợp." description="Thử đổi bộ lọc hoặc tạo voucher mới." />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {items.map((voucher) => {
              const allowed = voucherActions(voucher);
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
                          {/* Only a partner's voucher is locked: an admin's own disabled voucher is just off. */}
                          {voucher.partnerId && voucher.lockedByAdmin && voucher.status === "DISABLED" && <VoucherLockedBadge />}
                        </div>
                        <p className="mt-1 font-mono font-bold text-blue-700">{voucher.code}</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-right text-lg font-bold text-emerald-700">Giảm {discount(voucher)}</p>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <p>Đối tác: <strong>{voucher.businessName ?? "Toàn hệ thống (Admin)"}</strong></p>
                    <p>Áp dụng: <strong>{voucher.courtName ?? "Tất cả sân"}</strong></p>
                    <p>Đơn tối thiểu: <strong>{money(voucher.minBookingAmount)}</strong></p>
                    <p>Thời hạn: <strong>{date(voucher.startDate)} - {date(voucher.endDate)}</strong></p>
                    <p>Lượt dùng: <strong>{voucher.usedCount}/{voucher.usageLimit ?? "Không giới hạn"}</strong></p>
                    <p>Tiền giảm: <strong>{voucherFundingLabels[voucher.fundedBy] ?? voucher.fundedBy}</strong></p>
                    <p>Ngày tạo: <strong>{dateTime(voucher.createdAt)}</strong></p>
                    <p className="sm:col-span-2">Điều kiện: <strong>{describeVoucherConditions(voucher) ?? "Mọi ngày, mọi khung giờ"}</strong></p>
                  </div>

                  {voucher.partnerId && voucher.lockedByAdmin && voucher.status === "DISABLED" && voucher.lockReason && (
                    <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Lý do tạm ngưng: {voucher.lockReason}</p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Link to={`/admin/vouchers/${voucher.id}/edit`}>
                      <Button variant="secondary">
                        {allowed.edit ? <><Pencil className="h-4 w-4" /> Chỉnh sửa</> : <><Eye className="h-4 w-4" /> Xem chi tiết</>}
                      </Button>
                    </Link>
                    {allowed.activate && (
                      <Button onClick={() => setPending({ voucher, action: "activate" })}>
                        <ShieldCheck className="h-4 w-4" /> {voucher.status === "DRAFT" ? "Kích hoạt" : "Kích hoạt lại"}
                      </Button>
                    )}
                    {allowed.disable && (
                      <Button variant="danger" onClick={() => setPending({ voucher, action: "disable" })}>
                        <ShieldOff className="h-4 w-4" /> Vô hiệu hóa
                      </Button>
                    )}
                    {allowed.note && <span className="text-xs text-slate-500">{allowed.note}</span>}
                  </div>
                </article>
              );
            })}
          </div>

          <TablePagination
            page={page}
            totalPages={q.data?.meta?.totalPages ?? 1}
            total={q.data?.meta?.total ?? 0}
            limit={limit}
            itemLabel="voucher"
            pageSizeOptions={[10, 20, 50]}
            onPageChange={setPage}
            onLimitChange={(value) => {
              setPage(1);
              setLimit(value);
            }}
          />
        </>
      )}

      <ReasonModal
        // A new key per voucher and action starts each confirmation with an empty reason.
        key={pending ? `${pending.voucher.id}-${pending.action}` : "closed"}
        open={Boolean(pending)}
        title={
          pending?.action === "activate"
            ? `Kích hoạt voucher ${pending.voucher.code}`
            : `Vô hiệu hóa voucher ${pending?.voucher.code ?? ""}`
        }
        // The partner receives the reason, so a partner voucher is never disabled without one.
        required={pending?.action === "disable" && Boolean(pending.voucher.partnerId)}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && !action.isPending && action.mutate({ ...pending, reason })}
      />
    </div>
  );
}
