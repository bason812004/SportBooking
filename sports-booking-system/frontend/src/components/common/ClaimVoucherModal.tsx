import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Check, Gift, MapPin, TicketPercent, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";

type Props = {
  voucher: VoucherData | null;
  open: boolean;
  onClaim: (voucherId: string) => Promise<void>;
  onClose: () => void;
};

type VoucherData = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount?: number | null;
  minBookingAmount: number;
  endDate: string;
  usageLimit?: number | null;
  usedCount: number;
  partner?: { id: string; businessName: string };
  court?: { id: string; name: string; city: string; district: string; imageUrl?: string | null } | null;
};

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatDiscount(type: string, value: number, max?: number | null) {
  if (type === "PERCENTAGE") {
    return max != null ? `Giảm ${value}% tối đa ${currency.format(max)}` : `Giảm ${value}%`;
  }
  return `Giảm ${currency.format(value)}`;
}

export function ClaimVoucherModal({ voucher, open, onClaim, onClose }: Props) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setClaimed(false);
    setError(null);
    setClaiming(false);
  }, [voucher?.id, open]);

  async function handleClaim() {
    if (!voucher) return;
    setClaiming(true);
    setError(null);
    try {
      await onClaim(voucher.id);
      setClaimed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể nhận voucher.");
    } finally {
      setClaiming(false);
    }
  }

  if (!voucher) return null;

  const remaining = voucher.usageLimit != null ? Math.max(voucher.usageLimit - voucher.usedCount, 0) : null;
  const outOfStock = remaining === 0;
  const ownerName = voucher.partner?.businessName ?? "SportBooking";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4"
          onClick={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 18 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="relative h-44 bg-slate-900">
              {voucher.court?.imageUrl ? (
                <img src={voucher.court.imageUrl} alt={voucher.court.name} className="h-full w-full object-cover opacity-65" />
              ) : (
                <div className="grid h-full place-items-center bg-gradient-to-br from-teal-600 to-emerald-600">
                  <Gift className="h-16 w-16 text-white/80" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />

              <div className="absolute left-4 top-4 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">
                <span className="flex items-center gap-1">
                  <TicketPercent className="h-3 w-3" />
                  Voucher mới
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
                aria-label="Đóng popup voucher"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-sm font-semibold text-white/80">{ownerName}</p>
                <h2 className="mt-1 text-xl font-black text-white">{voucher.title}</h2>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {claimed ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100">
                    <Check className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-emerald-700">Đã lưu voucher</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Mã <span className="font-mono font-black text-teal-700">{voucher.code}</span> đã nằm trong kho của bạn.
                    </p>
                  </div>
                  <Button onClick={onClose} className="w-full">Đóng</Button>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                    <p className="text-2xl font-black text-teal-700">
                      {formatDiscount(voucher.discountType, voucher.discountValue, voucher.maxDiscountAmount)}
                    </p>
                    <p className="mt-1 font-mono text-sm font-black tracking-widest text-slate-700">{voucher.code}</p>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0 text-teal-600" />
                      Hết hạn {dateFormat.format(new Date(voucher.endDate))}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
                      {voucher.court ? `${voucher.court.name}, ${voucher.court.district}` : ownerName}
                    </p>
                    <p className="text-xs text-slate-500">Đơn tối thiểu {currency.format(voucher.minBookingAmount)}</p>
                    {remaining != null && (
                      <p className="text-xs font-semibold text-rose-600">
                        {outOfStock ? "Voucher đã hết lượt nhận" : `Chỉ còn ${remaining} lượt`}
                      </p>
                    )}
                  </div>

                  {error && (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={onClose} className="flex-1">
                      Bỏ qua
                    </Button>
                    <Button onClick={handleClaim} disabled={claiming || outOfStock} className="flex-1">
                      {claiming ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Đang nhận
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Gift className="h-4 w-4" />
                          Nhận voucher
                        </span>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
