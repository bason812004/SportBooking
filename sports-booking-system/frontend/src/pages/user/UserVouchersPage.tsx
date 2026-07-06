import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Copy, Gift, Loader2, MapPin, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { voucherApi } from "../../features/bookings/api/bookingApi";
import { useVouchers } from "../../features/content/hooks/useContent";
import type { MyVoucher, UserVoucherStatus, Voucher } from "../../types/api";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function discountText(voucher: Pick<Voucher, "discountType" | "discountValue">) {
  return voucher.discountType === "PERCENTAGE" ? `Giảm ${voucher.discountValue}%` : `Giảm ${currency.format(voucher.discountValue)}`;
}

function statusText(status?: UserVoucherStatus) {
  if (status === "USED") return "Đã dùng";
  if (status === "EXPIRED") return "Hết hạn";
  return "Đã nhận";
}

function remainingText(voucher: Pick<Voucher, "usageLimit" | "usedCount">) {
  if (voucher.usageLimit == null) return "Không giới hạn lượt";
  return `Còn ${Math.max(voucher.usageLimit - voucher.usedCount, 0)} lượt`;
}

export function UserVouchersPage() {
  const queryClient = useQueryClient();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [localClaimedIds, setLocalClaimedIds] = useState<Set<string>>(new Set());

  const myVouchers = useQuery({
    queryKey: ["my-vouchers"],
    queryFn: voucherApi.myVouchers,
    staleTime: 30_000
  });
  const activeVouchers = useVouchers();

  const claimedIds = useMemo(() => {
    const ids = new Set((myVouchers.data ?? []).map((voucher) => voucher.id));
    for (const id of localClaimedIds) ids.add(id);
    return ids;
  }, [localClaimedIds, myVouchers.data]);

  const suggestions = useMemo(
    () => (activeVouchers.data ?? []).filter((voucher) => !claimedIds.has(voucher.id)).slice(0, 6),
    [activeVouchers.data, claimedIds]
  );

  async function copyCode(voucher: Voucher | MyVoucher) {
    await navigator.clipboard?.writeText(voucher.code);
    toast.success(`Đã sao chép mã ${voucher.code}.`);
  }

  async function claim(voucherId: string) {
    setClaimingId(voucherId);
    try {
      await voucherApi.claim(voucherId);
      setLocalClaimedIds((current) => new Set([...current, voucherId]));
      await queryClient.invalidateQueries({ queryKey: ["my-vouchers"] });
      toast.success("Đã lưu voucher vào kho của bạn.");
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: ["my-vouchers"] });
      toast.error(error instanceof Error ? error.message : "Không thể nhận voucher.");
    } finally {
      setClaimingId(null);
    }
  }

  if (myVouchers.isLoading) {
    return (
      <main className="bg-[#f5f7fb] px-4 py-12">
        <div className="mx-auto max-w-6xl"><LoadingState /></div>
      </main>
    );
  }

  if (myVouchers.isError) {
    return (
      <main className="bg-[#f5f7fb] px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <ErrorState message={myVouchers.error.message} onRetry={() => void myVouchers.refetch()} />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#f5f7fb] px-4 py-12 text-[#0b1220]">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-200 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-emerald-100">
                <TicketPercent className="h-4 w-4" />
                Voucher của tôi
              </p>
              <h1 className="mt-5 text-4xl font-black md:text-5xl">Kho voucher đã nhận</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                Các mã đã nhận được lưu theo tài khoản và có thể dùng khi đặt sân phù hợp.
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 px-6 py-4 text-center">
              <p className="text-4xl font-black">{myVouchers.data?.length ?? 0}</p>
              <p className="text-sm text-slate-300">mã đã nhận</p>
            </div>
          </div>
        </section>

        {myVouchers.data?.length ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {myVouchers.data.map((voucher) => (
              <VoucherCard key={voucher.userVoucherId} voucher={voucher} action={<ClaimedBadge status={voucher.status} />} onCopy={() => void copyCode(voucher)} />
            ))}
          </section>
        ) : (
          <EmptyState title="Bạn chưa nhận voucher nào" description="Chọn một voucher đang hoạt động bên dưới để lưu vào tài khoản." />
        )}

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#0f766e]">Gợi ý từ hệ thống</p>
              <h2 className="mt-2 text-3xl font-black">Voucher đang hoạt động</h2>
            </div>
            <Link to="/vouchers" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:border-[#0f766e] hover:text-[#0f766e]">
              Xem tất cả
            </Link>
          </div>

          {activeVouchers.isLoading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-[1.5rem] bg-white" />)}
            </div>
          ) : suggestions.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {suggestions.map((voucher) => (
                <VoucherCard
                  key={voucher.id}
                  voucher={voucher}
                  onCopy={() => void copyCode(voucher)}
                  action={
                    <button
                      type="button"
                      onClick={() => void claim(voucher.id)}
                      disabled={claimingId === voucher.id || (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0f766e] px-4 text-sm font-black text-white hover:bg-[#115e59] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {claimingId === voucher.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                      Nhận voucher
                    </button>
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 font-semibold text-slate-600">
              Hiện không còn voucher mới để nhận.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ClaimedBadge({ status }: { status: UserVoucherStatus }) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-emerald-100 px-4 text-sm font-black text-emerald-800">
      <Check className="h-4 w-4" />
      {statusText(status)}
    </span>
  );
}

function VoucherCard({ voucher, action, onCopy }: { voucher: Voucher | MyVoucher; action: ReactNode; onCopy: () => void }) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-40 bg-slate-200">
        {voucher.court?.imageUrl ? (
          <img src={voucher.court.imageUrl} alt={voucher.court.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-emerald-100 to-sky-100 text-[#0f766e]">
            <TicketPercent className="h-12 w-12" />
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">
          {discountText(voucher)}
        </span>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <h3 className="line-clamp-2 text-xl font-black text-slate-950">{voucher.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{voucher.description}</p>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-lg font-black tracking-widest text-[#0f766e]">{voucher.code}</span>
            <button
              type="button"
              aria-label={`Sao chép mã ${voucher.code}`}
              onClick={onCopy}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-[#0f766e] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">Đơn tối thiểu {currency.format(voucher.minBookingAmount)}</p>
        </div>

        <div className="space-y-2 text-sm font-semibold text-slate-600">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#0f766e]" />
            Hết hạn {dateFormat.format(new Date(voucher.endDate))}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#0f766e]" />
            {voucher.court ? `${voucher.court.name}, ${voucher.court.district}` : voucher.partner.businessName}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-500">{remainingText(voucher)}</span>
          <div className="flex flex-wrap items-center gap-2">
            {action}
            {voucher.court?.id && (
              <Link
                to={`/courts/${voucher.court.id}`}
                className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800"
              >
                Đặt sân
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
