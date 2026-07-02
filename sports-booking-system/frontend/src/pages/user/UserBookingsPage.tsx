import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Filter,
  MapPin,
  Receipt,
  Search,
  Tag,
  Ticket,
  Wallet
} from "lucide-react";
import { bookingApi } from "../../features/bookings/api/bookingApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { useLanguage } from "../../lib/i18n";
import {
  bookingStatusLabel,
  formatCurrency,
  formatDate,
  paymentStatusLabel,
  statusBadgeClass,
  timeText
} from "../../lib/format";
import clsx from "clsx";

type StatusFilter = "ALL" | "UPCOMING" | "COMPLETED" | "CANCELLED" | "PENDING";

const FILTERS: Array<{ id: StatusFilter; label: string; predicate: (status: string) => boolean }> = [
  { id: "ALL", label: "Tất cả", predicate: () => true },
  { id: "UPCOMING", label: "Sắp tới", predicate: (status) => ["PENDING", "CONFIRMED", "DEPOSITED", "AWAITING_PAYMENT"].includes(status) },
  { id: "PENDING", label: "Chờ thanh toán", predicate: (status) => status === "PENDING" || status === "AWAITING_PAYMENT" },
  { id: "COMPLETED", label: "Hoàn tất", predicate: (status) => status === "COMPLETED" || status === "PAID" },
  { id: "CANCELLED", label: "Đã hủy", predicate: (status) => status === "CANCELLED" }
];

export function UserBookingsPage() {
  const { t } = useLanguage();
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: bookingApi.listMine });
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    const items = bookings.data?.items ?? [];
    const predicate = FILTERS.find((filter) => filter.id === status)?.predicate ?? (() => true);
    const term = keyword.trim().toLowerCase();
    return items
      .filter((booking) => predicate(booking.bookingStatus))
      .filter((booking) => {
        if (!term) return true;
        return (
          booking.bookingCode.toLowerCase().includes(term) ||
          booking.court.name.toLowerCase().includes(term) ||
          booking.court.city.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings.data, status, keyword]);

  const counts = useMemo(() => {
    const items = bookings.data?.items ?? [];
    return FILTERS.reduce<Record<StatusFilter, number>>((acc, filter) => {
      acc[filter.id] = items.filter((b) => filter.predicate(b.bookingStatus)).length;
      return acc;
    }, { ALL: 0, UPCOMING: 0, PENDING: 0, COMPLETED: 0, CANCELLED: 0 });
  }, [bookings.data]);

  if (bookings.isLoading) return <LoadingState />;
  if (bookings.isError) return <ErrorState message={bookings.error.message} onRetry={() => bookings.refetch()} />;

  return (
    <div className="bg-[#f4f7f5] py-8">
      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Tài khoản</p>
            <h1 className="text-3xl font-black text-slate-900">{t("Lịch sử đặt sân")}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi, quản lý và thanh toán các đơn đặt sân của bạn.
            </p>
          </div>
          <Link
            to="/courts"
            className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Tag className="h-4 w-4" />
            Đặt sân mới
          </Link>
        </header>

        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-5">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatus(filter.id)}
              className={clsx(
                "rounded-2xl border px-4 py-3 text-left transition",
                status === filter.id
                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-emerald-300"
              )}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{filter.label}</p>
              <p className={clsx("mt-1 text-2xl font-black", status === filter.id ? "text-emerald-700" : "text-slate-900")}>
                {counts[filter.id]}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm theo mã đơn, tên sân, thành phố..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
            <Filter className="h-4 w-4" />
            Đang hiển thị {filtered.length} / {bookings.data?.items.length ?? 0} đơn
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title={t("Bạn chưa có đơn đặt sân")}
              description="Hãy thử tìm một sân phù hợp và đặt lịch ngay hôm nay."
              actionLabel="Khám phá sân"
              onAction={() => (window.location.href = "/courts")}
            />
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {filtered.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BookingRow({ booking }: { booking: import("../../types/api").Booking }) {
  const courtImage = booking.court.images?.[0]?.imageUrl;
  const voucher = booking.bookingVoucher?.voucher;
  const status = booking.bookingStatus;
  const paymentStatus = booking.paymentStatus;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-emerald-100">
            {courtImage ? (
              <img src={courtImage} alt={booking.court.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-emerald-700">
                <MapPin className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600">
                #{booking.bookingCode}
              </span>
              <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", statusBadgeClass("BOOKING", status))}>
                {bookingStatusLabel(status)}
              </span>
              <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", statusBadgeClass("PAYMENT", paymentStatus))}>
                {paymentStatusLabel(paymentStatus)}
              </span>
            </div>
            <p className="mt-1.5 text-base font-black text-slate-900">{booking.court.name}</p>
            <p className="text-xs text-slate-500">
              {[booking.court.address, booking.court.district, booking.court.city].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-4 md:justify-end">
          <Stat icon={CalendarDays} label="Ngày chơi" value={formatDate(booking.bookingDate)} />
          <Stat icon={Clock3} label="Khung giờ" value={`${timeText(booking.startTime)} - ${timeText(booking.endTime)}`} />
          <Stat
            icon={Wallet}
            label="Tổng tiền"
            value={formatCurrency(booking.totalPrice)}
            accent
          />
          {voucher && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              <Ticket className="h-3.5 w-3.5" />
              Voucher {voucher.code}
            </div>
          )}
        </div>

        <Link
          to={`/user/bookings/${booking.id}`}
          className="inline-flex items-center gap-1 self-start rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 md:self-center"
        >
          <Receipt className="h-3.5 w-3.5" />
          Chi tiết
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </li>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={clsx("flex items-center gap-2 rounded-xl px-3 py-2", accent ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700")}>
      <Icon className={clsx("h-4 w-4", accent ? "text-emerald-50" : "text-emerald-700")} />
      <div className="leading-tight">
        <p className={clsx("text-[10px] font-black uppercase tracking-wider", accent ? "text-emerald-100" : "text-slate-400")}>
          {label}
        </p>
        <p className={clsx("text-sm font-bold", accent ? "text-white" : "text-slate-900")}>{value}</p>
      </div>
    </div>
  );
}