import { motion } from "framer-motion";
import { CalendarDays, Copy, Gift, MapPin, TicketPercent } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState } from "../../components/common/States";
import { useVouchers } from "../../features/content/hooks/useContent";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatDiscount(type: string, value: number) {
  return type === "PERCENTAGE" ? `Giảm ${value}%` : `Giảm ${currency.format(value)}`;
}

export function VouchersPage() {
  const vouchers = useVouchers();

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
                Lấy mã giảm giá từ các đối tác đã xác thực và áp dụng khi đặt sân trong thời gian khuyến mãi.
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
            <EmptyState title="Chưa có voucher đang hoạt động. Hãy kiểm tra lại dữ liệu seed hoặc thời hạn voucher." />
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {vouchers.data.map((voucher, index) => {
              const remaining = voucher.usageLimit ? Math.max(voucher.usageLimit - voucher.usedCount, 0) : null;
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
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{voucher.description}</p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-lg font-black tracking-widest text-teal-700">{voucher.code}</span>
                        <Copy className="h-4 w-4 text-slate-400" />
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
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">
                        {remaining === null ? "Không giới hạn lượt dùng" : `Còn ${remaining} lượt`}
                      </span>
                      {voucher.court?.id && (
                        <Link to={`/courts/${voucher.court.id}`} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                          Đặt sân
                        </Link>
                      )}
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
