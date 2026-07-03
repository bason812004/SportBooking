import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Clock3, CreditCard, MapPin, Receipt, RotateCcw, Search, SlidersHorizontal, Ticket } from "lucide-react";
import clsx from "clsx";
import { bookingApi } from "../../features/bookings/api/bookingApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import {
  bookingStatusLabel,
  durationText,
  formatCurrency,
  formatDate,
  formatDateTime,
  paymentMethodLabel,
  paymentStatusLabel,
  statusBadgeClass,
  timeText
} from "../../lib/format";
import type { Booking } from "../../types/api";

const BOOKING_FILTERS = ["ALL", "PENDING", "PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const PAYMENT_FILTERS = ["ALL", "UNPAID", "PENDING", "PAID", "REFUNDED", "PARTIALLY_REFUNDED"];

export function UserBookingsPage() {
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: bookingApi.listMine });
  const [keyword, setKeyword] = useState("");
  const [bookingStatus, setBookingStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [sort, setSort] = useState<"NEWEST" | "OLDEST">("NEWEST");

  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return [...(bookings.data?.items ?? [])]
      .filter((booking) => bookingStatus === "ALL" || booking.bookingStatus === bookingStatus)
      .filter((booking) => paymentStatus === "ALL" || booking.paymentStatus === paymentStatus)
      .filter((booking) => {
        if (!term) return true;
        return (
          booking.bookingCode.toLowerCase().includes(term) ||
          booking.court.name.toLowerCase().includes(term) ||
          [booking.court.address, booking.court.district, booking.court.city].filter(Boolean).join(" ").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sort === "NEWEST" ? -diff : diff;
      });
  }, [bookings.data?.items, keyword, bookingStatus, paymentStatus, sort]);

  if (bookings.isLoading) return <LoadingState />;
  if (bookings.isError) return <ErrorState message={bookings.error.message} onRetry={() => bookings.refetch()} />;

  return (
    <div className="min-h-screen bg-[#f4f8f6] py-8 text-slate-950">
      <div className="mx-auto max-w-7xl px-4">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Tài khoản</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">Lịch sử đặt sân</h1>
            <p className="mt-1 text-sm text-slate-500">Theo dõi trạng thái, thanh toán, voucher và dịch vụ đi kèm trong từng đơn.</p>
          </div>
          <Link to="/courts" className="inline-flex items-center gap-2 self-start rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700">
            <CalendarDays className="h-4 w-4" />
            Đặt sân mới
          </Link>
        </header>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_160px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm theo mã booking, tên sân, địa chỉ..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <SelectFilter value={bookingStatus} onChange={setBookingStatus} options={BOOKING_FILTERS} labelFor={(value) => (value === "ALL" ? "Mọi trạng thái" : bookingStatusLabel(value))} />
            <SelectFilter value={paymentStatus} onChange={setPaymentStatus} options={PAYMENT_FILTERS} labelFor={(value) => (value === "ALL" ? "Mọi thanh toán" : paymentStatusLabel(value))} />
            <select value={sort} onChange={(event) => setSort(event.target.value as "NEWEST" | "OLDEST")} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
              <option value="NEWEST">Mới nhất</option>
              <option value="OLDEST">Cũ nhất</option>
            </select>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500">
            <SlidersHorizontal className="h-4 w-4" />
            Đang hiển thị {filtered.length} / {bookings.data?.items.length ?? 0} đơn
          </p>
        </section>

        {filtered.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Bạn chưa có lịch đặt sân nào"
              description="Tìm một sân phù hợp và đặt lịch để đơn của bạn xuất hiện tại đây."
              actionLabel="Khám phá sân"
              onAction={() => (window.location.href = "/courts")}
            />
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {filtered.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SelectFilter({ value, onChange, options, labelFor }: { value: string; onChange: (value: string) => void; options: string[]; labelFor: (value: string) => string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
      {options.map((option) => (
        <option key={option} value={option}>{labelFor(option)}</option>
      ))}
    </select>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const courtImage = booking.court.images?.[0]?.imageUrl;
  const voucher = booking.bookingVoucher?.voucher;
  const services = booking.bookingServices ?? [];
  const serviceTotal = services.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);
  const address = [booking.court.address, booking.court.district, booking.court.city].filter(Boolean).join(", ") || "Chưa cập nhật địa chỉ";
  const canPay = !["PAID", "REFUNDED"].includes(booking.paymentStatus);
  const paymentId = booking.payments?.[0]?.id;

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-300 hover:shadow-md">
      <div className="grid gap-4 p-4 lg:grid-cols-[180px_1fr_auto]">
        <div className="h-40 overflow-hidden rounded-xl bg-slate-100 lg:h-full">
          {courtImage ? <img src={courtImage} alt={booking.court.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-emerald-700"><MapPin className="h-7 w-7" /></div>}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">#{booking.bookingCode}</span>
            <span className={clsx("rounded-full px-2.5 py-1 text-xs font-black", statusBadgeClass("BOOKING", booking.bookingStatus))}>{bookingStatusLabel(booking.bookingStatus)}</span>
            <span className={clsx("rounded-full px-2.5 py-1 text-xs font-black", statusBadgeClass("PAYMENT", booking.paymentStatus))}>{paymentStatusLabel(booking.paymentStatus)}</span>
          </div>

          <h2 className="mt-3 text-xl font-black text-slate-950">{booking.court.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{booking.court.category?.name ?? "Sân thể thao"} · {address}</p>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <Info icon={CalendarDays} label="Ngày đặt" value={formatDate(booking.bookingDate)} />
            <Info icon={Clock3} label="Khung giờ" value={`${timeText(booking.startTime)} - ${timeText(booking.endTime)}`} />
            <Info icon={Clock3} label="Thời lượng" value={durationText(booking.startTime, booking.endTime)} />
            <Info icon={CreditCard} label="Thanh toán" value={paymentMethodLabel(booking.paymentMethod)} />
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {voucher && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-700">
                <Ticket className="h-4 w-4" />
                {voucher.code} · giảm {formatCurrency(booking.bookingVoucher?.discountAmount)}
              </div>
            )}
            {services.length > 0 && (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700">
                <span className="font-bold">Dịch vụ:</span> {services.map((line) => `${line.service.name} x${line.quantity}`).join(", ")}
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col justify-between gap-4 rounded-2xl bg-slate-50 p-4 lg:w-56">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Tổng cuối cùng</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">{formatCurrency(booking.totalPrice)}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>Tạm tính: {formatCurrency(booking.subtotal ?? booking.totalPrice)}</p>
              <p>Dịch vụ: {formatCurrency(serviceTotal)}</p>
              <p>Tạo lúc: {formatDateTime(booking.createdAt)}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Link to={`/user/bookings/${booking.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-black text-white transition hover:bg-slate-800">
              <Receipt className="h-4 w-4" />
              Xem chi tiết
              <ChevronRight className="h-4 w-4" />
            </Link>
            {canPay && (
              <Link to={paymentId ? `/payment/${paymentId}` : `/user/bookings/${booking.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white transition hover:bg-emerald-700">
                <CreditCard className="h-4 w-4" />
                Thanh toán
              </Link>
            )}
            <Link to={`/booking/${booking.court.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">
              <RotateCcw className="h-4 w-4" />
              Đặt lại sân
            </Link>
          </div>
        </aside>
      </div>
    </li>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <Icon className="h-4 w-4 text-emerald-600" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}
