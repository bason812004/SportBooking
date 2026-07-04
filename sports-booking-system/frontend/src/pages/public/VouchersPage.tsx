import { motion } from "framer-motion";
import { CalendarDays, Check, Copy, Gift, Loader2, LockKeyhole, MapPin, TicketPercent } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "../../components/common/States";
import { contentApi } from "../../features/content/api/contentApi";
import { voucherApi } from "../../features/bookings/api/bookingApi";
import { useVouchers } from "../../features/content/hooks/useContent";
import { useAuth } from "../../features/auth/hooks/useAuth";
import type { UserVoucherStatus, Voucher } from "../../types/api";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatDiscount(type: string, value: number) {
  return type === "PERCENTAGE" ? `Giảm ${value}%` : `Giảm ${currency.format(value)}`;
}

function claimLabel(status?: UserVoucherStatus) {
  if (status === "CLAIMED") return "Đã nhận";
  if (status === "USED") return "Đã dùng";
  if (status === "EXPIRED") return "Hết hạn";
  return null;
}

function trackVoucherClick(id: string) {
  void contentApi.trackVoucherClick(id).catch(() => undefined);
}

export function VouchersPage() {
  const vouchers = useVouchers();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [localClaimedIds, setLocalClaimedIds] = useState<Set<string>>(new Set());

  const myVouchers = useQuery({
    queryKey: ["my-vouchers"],
    queryFn: voucherApi.myVouchers,
    enabled: isAuthenticated && user?.role === "USER",
    staleTime: 30_000
  });

  const claimedStatus = useMemo(() => {
    const map = new Map<string, UserVoucherStatus>();
    for (const item of myVouchers.data ?? []) map.set(item.id, item.status);
    for (const id of localClaimedIds) map.set(id, "CLAIMED");
    return map;
  }, [localClaimedIds, myVouchers.data]);

  async function copyCode(voucher: Voucher) {
    trackVoucherClick(voucher.id);
    await navigator.clipboard?.writeText(voucher.code);
    toast.success(`Đã sao chép mã ${voucher.code}.`);
  }

  async function handleClaim(voucherId: string) {
    if (!isAuthenticated || user?.role !== "USER") {
      toast.error("Vui lòng đăng nhập tài khoản người dùng để nhận voucher.");
      navigate("/login");
      return;
    }

    setClaimingId(voucherId);
    try {
      await voucherApi.claim(voucherId);
      setLocalClaimedIds((prev) => new Set([...prev, voucherId]));
      await queryClient.invalidateQueries({ queryKey: ["my-vouchers"] });
      toast.success("Nhận voucher thành công. Voucher đã được lưu vào kho của bạn.");
    } catch (e) {
      await queryClient.invalidateQueries({ queryKey: ["my-vouchers"] });
      toast.error(e instanceof Error ? e.message : "Không thể nhận voucher.");
    } finally {
      setClaimingId(null);
    }
  }

  if (vouchers.isLoading) {
    return (
      <section className="bg-[#f5f7fb] px-4 py-12">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-40 animate-pulse rounded-[2rem] bg-white" />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-[1.5rem] bg-white" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (vouchers.isError) {
    return (
      <section className="bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <ErrorState message={vouchers.error.message} onRetry={() => void vouchers.refetch()} />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#f5f7fb] px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-200 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-teal-100">
                <Gift className="h-4 w-4" />
                Ưu đãi đang hoạt động
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight md:text-5xl">Voucher đặt sân hôm nay</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                Nhận voucher vào kho cá nhân, sau đó áp dụng khi đặt sân. 
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 px-6 py-4 text-center">
              <p className="text-4xl font-black">{vouchers.data?.length ?? 0}</p>
              <p className="text-sm text-slate-300">mã khả dụng</p>
            </div>
          </div>
        </div>

        {!vouchers.data?.length ? (
          <div className="mt-8">
            <EmptyState title="Chưa có voucher đang hoạt động" description="Hãy kiểm tra lại dữ liệu seed hoặc thời hạn voucher." />
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {vouchers.data.map((voucher, index) => {
              const remaining = voucher.usageLimit ? Math.max(voucher.usageLimit - voucher.usedCount, 0) : null;
              const status = claimedStatus.get(voucher.id);
              const claimedText = claimLabel(status);
              const isClaimed = Boolean(claimedText);
              return (
                <motion.article
                  key={voucher.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-40 bg-slate-200">
                    {voucher.court?.imageUrl ? (
                      <img src={voucher.court.imageUrl} alt={voucher.court.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full place-items-center bg-gradient-to-br from-teal-100 to-sky-100 text-teal-800">
                        <TicketPercent className="h-12 w-12" />
                      </div>
                    )}
                    <div className="absolute left-4 top-4 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">
                      {formatDiscount(voucher.discountType, voucher.discountValue)}
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <h2 className="line-clamp-2 text-xl font-black text-slate-950">{voucher.title}</h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{voucher.description}</p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-lg font-black tracking-widest text-teal-700">{voucher.code}</span>
                        <button
                          type="button"
                          aria-label={`Copy mã ${voucher.code}`}
                          onClick={() => void copyCode(voucher)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Đơn tối thiểu {currency.format(voucher.minBookingAmount)}</p>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-teal-600" />
                        Hết hạn {dateFormat.format(new Date(voucher.endDate))}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-teal-600" />
                        {voucher.court ? `${voucher.court.name}, ${voucher.court.district}` : voucher.partner.businessName}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {remaining === null ? "Không giới hạn lượt" : `Còn ${remaining} lượt`}
                      </span>
                      <div className="flex items-center gap-2">
                        {isClaimed ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                            <Check className="h-3 w-3" />
                            {claimedText}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleClaim(voucher.id)}
                            disabled={claimingId === voucher.id || remaining === 0}
                            className="flex items-center gap-1 rounded-full bg-teal-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
                          >
                            {claimingId === voucher.id ? <Loader2 className="h-3 w-3 animate-spin" /> : isAuthenticated ? <Gift className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}
                            {remaining === 0 ? "Hết lượt" : "Nhận voucher"}
                          </button>
                        )}
                        {voucher.court?.id && (
                          <Link
                            to={`/courts/${voucher.court.id}`}
                            onClick={() => trackVoucherClick(voucher.id)}
                            className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
                          >
                            Đặt sân
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
