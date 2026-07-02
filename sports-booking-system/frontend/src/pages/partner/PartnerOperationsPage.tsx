import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Hourglass,
  MapPin,
  PlayCircle,
  RefreshCcw,
  TimerReset
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { partnerApi } from "../../features/partner/api/partnerApi";
import type { PartnerOperationBooking, PartnerOperationItem } from "../../types/api";

const todayValue = () => new Date().toISOString().slice(0, 10);
const nowValue = () => new Date().toTimeString().slice(0, 5);
const money = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const statusMeta: Record<PartnerOperationItem["status"], { label: string; className: string; icon: typeof DoorOpen }> = {
  AVAILABLE: { label: "Trống", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: DoorOpen },
  OCCUPIED: { label: "Đang thuê", className: "border-blue-200 bg-blue-50 text-blue-800", icon: PlayCircle },
  ENDING_SOON: { label: "Sắp hết giờ", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Hourglass },
  OVERDUE: { label: "Quá giờ", className: "border-rose-200 bg-rose-50 text-rose-800", icon: AlertTriangle },
  RESERVED_SOON: { label: "Sắp có khách", className: "border-violet-200 bg-violet-50 text-violet-800", icon: CalendarClock },
  INACTIVE: { label: "Tạm ngưng", className: "border-slate-200 bg-slate-100 text-slate-700", icon: Clock3 }
};

function activeBooking(item: PartnerOperationItem) {
  return item.currentBooking ?? item.latestEndedBooking ?? null;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function BookingLine({ booking, label }: { booking: PartnerOperationBooking | null | undefined; label: string }) {
  if (!booking) return null;
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-sm">
      <p className="font-black text-slate-500">{label}</p>
      <div className="mt-2 grid gap-1">
        <p className="font-bold text-slate-950">{booking.customerName}</p>
        <p className="text-slate-600">{booking.startTime} - {booking.endTime} · {booking.bookingStatus}</p>
        <p className="text-slate-600">{money(booking.totalPrice)} · {booking.paymentStatus}</p>
      </div>
    </div>
  );
}

function CourtTile({ item, selected, onSelect }: { item: PartnerOperationItem; selected: boolean; onSelect: () => void }) {
  const meta = statusMeta[item.status];
  const Icon = meta.icon;
  const booking = activeBooking(item);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-line"
      }`}
    >
      <div className="relative aspect-[4/3] bg-slate-100">
        {(item.surface.imageUrl || item.court.imageUrl) ? (
          <img src={item.surface.imageUrl || item.court.imageUrl || ""} alt={item.surface.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-bold text-slate-500">Chưa có ảnh</div>
        )}
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${meta.className}`}>
          <Icon className="h-4 w-4" />
          {meta.label}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h2 className="line-clamp-1 text-lg font-black text-slate-950">{item.surface.name}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-500">
            <MapPin className="h-4 w-4" />
            {item.court.name} · {item.court.categoryName}
          </p>
        </div>
        {booking ? (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-bold text-slate-950">{booking.customerName}</p>
            <p className="mt-1 text-slate-600">{booking.startTime} - {booking.endTime}</p>
            {item.minutesLeft != null && item.minutesLeft >= 0 ? (
              <p className="mt-1 font-bold text-amber-700">Còn {item.minutesLeft} phút</p>
            ) : null}
          </div>
        ) : item.nextBooking ? (
          <div className="rounded-lg bg-violet-50 p-3 text-sm text-violet-800">
            <p className="font-black">Lịch tiếp theo</p>
            <p>{item.nextBooking.startTime} · {item.nextBooking.customerName}</p>
          </div>
        ) : (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Sẵn sàng nhận khách</div>
        )}
      </div>
    </button>
  );
}

export function PartnerOperationsPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayValue());
  const [nowTime, setNowTime] = useState(nowValue());
  const [status, setStatus] = useState("");
  const [duration, setDuration] = useState(60);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState({
    customerName: "",
    customerPhone: "",
    startTime: nowValue(),
    minutes: 60,
    paymentMethod: "CASH" as "CASH" | "BANK_TRANSFER" | "E_WALLET",
    note: ""
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNowTime(nowValue()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const operations = useQuery({
    queryKey: ["partner-operations", date, nowTime],
    queryFn: () => partnerApi.operations({ date, nowTime }),
    refetchInterval: 60_000
  });

  const items = operations.data?.items ?? [];
  const filteredItems = status ? items.filter((item) => item.status === status) : items;
  const selected = useMemo(
    () => items.find((item) => item.surface.id === selectedId) ?? filteredItems[0] ?? null,
    [filteredItems, items, selectedId]
  );
  const selectedBooking = selected ? activeBooking(selected) : null;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["partner-operations"] });
    await queryClient.invalidateQueries({ queryKey: ["partner-calendar"] });
    await queryClient.invalidateQueries({ queryKey: ["partner-bookings"] });
  };

  const extend = useMutation({
    mutationFn: ({ bookingId, minutes }: { bookingId: string; minutes: number }) => partnerApi.extendBooking(bookingId, minutes),
    onSuccess: async () => {
      toast.success("Đã gia hạn lượt chơi");
      await invalidate();
    },
    onError: (error) => toast.error(error.message)
  });

  const continueOnCourt = useMutation({
    mutationFn: ({ bookingId, targetCourtSurfaceId, minutes }: { bookingId: string; targetCourtSurfaceId: string; minutes: number }) =>
      partnerApi.continueBooking(bookingId, targetCourtSurfaceId, minutes),
    onSuccess: async () => {
      toast.success("Đã tạo lượt chơi tiếp trên sân trống");
      await invalidate();
    },
    onError: (error) => toast.error(error.message)
  });

  const complete = useMutation({
    mutationFn: (bookingId: string) => partnerApi.setBookingStatus(bookingId, "complete"),
    onSuccess: async () => {
      toast.success("Đã kết thúc lượt chơi");
      await invalidate();
    },
    onError: (error) => toast.error(error.message)
  });

  const createWalkIn = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Chọn sân con trước khi đặt nhanh");
      return partnerApi.createWalkInBooking({
        courtSurfaceId: selected.surface.id,
        customerName: walkIn.customerName,
        customerPhone: walkIn.customerPhone,
        bookingDate: date,
        startTime: walkIn.startTime,
        minutes: walkIn.minutes,
        paymentMethod: walkIn.paymentMethod,
        note: walkIn.note || undefined
      });
    },
    onSuccess: async () => {
      toast.success("Đã tạo booking tại quầy");
      setWalkIn({ customerName: "", customerPhone: "", startTime: nowValue(), minutes: 60, paymentMethod: "CASH", note: "" });
      await invalidate();
    },
    onError: (error) => toast.error(error.message)
  });

  if (operations.isLoading) return <LoadingState />;
  if (operations.isError) return <ErrorState message={operations.error.message} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-black uppercase text-blue-700">
            <TimerReset className="h-4 w-4" />
            Điều phối trực tiếp
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Vận hành sân hôm nay</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Theo dõi sân trống, sân đang thuê, sân sắp hết giờ và xử lý gia hạn hoặc chuyển sân ngay tại quầy.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Ngày" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Input label="Thời điểm" type="time" value={nowTime} onChange={(event) => setNowTime(event.target.value)} />
          <Button variant="secondary" onClick={() => operations.refetch()}>
            <RefreshCcw className="h-4 w-4" />
            Làm mới
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Trống" value={operations.data?.summary.available ?? 0} tone="text-emerald-700" />
        <Stat label="Đang thuê" value={operations.data?.summary.occupied ?? 0} tone="text-blue-700" />
        <Stat label="Sắp hết giờ" value={operations.data?.summary.endingSoon ?? 0} tone="text-amber-700" />
        <Stat label="Quá giờ" value={operations.data?.summary.overdue ?? 0} tone="text-rose-700" />
        <Stat label="Sắp có khách" value={operations.data?.summary.reservedSoon ?? 0} tone="text-violet-700" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-line bg-white p-4">
            <Select
              label="Lọc trạng thái"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={[
                { value: "", label: "Tất cả sân" },
                { value: "AVAILABLE", label: "Trống" },
                { value: "OCCUPIED", label: "Đang thuê" },
                { value: "ENDING_SOON", label: "Sắp hết giờ" },
                { value: "OVERDUE", label: "Quá giờ" },
                { value: "RESERVED_SOON", label: "Sắp có khách" },
                { value: "INACTIVE", label: "Tạm ngưng" }
              ]}
            />
          </div>
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {filteredItems.map((item) => (
              <CourtTile key={item.surface.id} item={item} selected={selected?.surface.id === item.surface.id} onSelect={() => setSelectedId(item.surface.id)} />
            ))}
          </div>
        </section>

        <aside className="h-max rounded-lg border border-line bg-white p-5 xl:sticky xl:top-6">
          {selected ? (
            <div className="space-y-5">
              <div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusMeta[selected.status].className}`}>
                  {statusMeta[selected.status].label}
                </span>
                <h2 className="mt-3 text-2xl font-black text-slate-950">{selected.surface.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selected.court.name} · {selected.court.categoryName}</p>
              </div>

              <BookingLine booking={selected.currentBooking} label="Đang chơi" />
              <BookingLine booking={selected.latestEndedBooking} label="Vừa hết giờ" />
              <BookingLine booking={selected.nextBooking} label="Lịch tiếp theo" />

              {selectedBooking ? (
                <div className="space-y-3 border-t border-line pt-5">
                  <Select
                    label="Thời lượng xử lý"
                    value={String(duration)}
                    onChange={(event) => setDuration(Number(event.target.value))}
                    options={[
                      { value: "30", label: "30 phút" },
                      { value: "60", label: "60 phút" },
                      { value: "90", label: "90 phút" }
                    ]}
                  />
                  <Button
                    className="w-full"
                    disabled={!selected.canExtend || extend.isPending}
                    onClick={() => extend.mutate({ bookingId: selectedBooking.id, minutes: duration })}
                  >
                    <Clock3 className="h-4 w-4" />
                    Gia hạn trên sân này
                  </Button>
                  {!selected.canExtend && (
                    <p className="text-sm font-semibold text-amber-700">Sân này không trống sau giờ hiện tại. Chọn sân thay thế bên dưới.</p>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-black text-slate-500">Sân trống có thể chuyển</p>
                    {selected.alternatives.length ? (
                      selected.alternatives.map((court) => (
                        <button
                          key={court.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-lg border border-line p-3 text-left transition hover:bg-slate-50"
                          disabled={continueOnCourt.isPending}
                          onClick={() => continueOnCourt.mutate({ bookingId: selectedBooking.id, targetCourtSurfaceId: court.surfaceId, minutes: duration })}
                        >
                          <span>
                            <span className="block font-bold text-slate-950">{court.name}</span>
                            <span className="text-sm text-slate-500">{court.categoryName}</span>
                          </span>
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        </button>
                      ))
                    ) : (
                      <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">Không có sân thay thế phù hợp trong khung giờ này.</p>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    variant="danger"
                    disabled={complete.isPending}
                    onClick={() => complete.mutate(selectedBooking.id)}
                  >
                    Kết thúc lượt chơi
                  </Button>
                </div>
              ) : (
                <form
                  className="space-y-4 rounded-lg bg-emerald-50 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createWalkIn.mutate();
                  }}
                >
                  <div>
                    <p className="text-sm font-black text-emerald-800">Đặt nhanh tại quầy</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-700">Tạo booking CONFIRMED cho khách vãng lai trên sân con này.</p>
                  </div>
                  <Input
                    label="Tên khách"
                    value={walkIn.customerName}
                    onChange={(event) => setWalkIn({ ...walkIn, customerName: event.target.value })}
                    required
                  />
                  <Input
                    label="Số điện thoại"
                    value={walkIn.customerPhone}
                    onChange={(event) => setWalkIn({ ...walkIn, customerPhone: event.target.value })}
                    required
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Bắt đầu"
                      type="time"
                      value={walkIn.startTime}
                      onChange={(event) => setWalkIn({ ...walkIn, startTime: event.target.value })}
                      required
                    />
                    <Select
                      label="Thời lượng"
                      value={String(walkIn.minutes)}
                      onChange={(event) => setWalkIn({ ...walkIn, minutes: Number(event.target.value) })}
                      options={[
                        { value: "30", label: "30 phút" },
                        { value: "60", label: "60 phút" },
                        { value: "90", label: "90 phút" },
                        { value: "120", label: "120 phút" }
                      ]}
                    />
                  </div>
                  <Select
                    label="Thanh toán"
                    value={walkIn.paymentMethod}
                    onChange={(event) => setWalkIn({ ...walkIn, paymentMethod: event.target.value as typeof walkIn.paymentMethod })}
                    options={[
                      { value: "CASH", label: "Tiền mặt" },
                      { value: "BANK_TRANSFER", label: "Chuyển khoản" },
                      { value: "E_WALLET", label: "Ví điện tử" }
                    ]}
                  />
                  <Input
                    label="Ghi chú"
                    value={walkIn.note}
                    onChange={(event) => setWalkIn({ ...walkIn, note: event.target.value })}
                  />
                  <Button className="w-full" disabled={createWalkIn.isPending}>
                    {createWalkIn.isPending ? "Đang tạo booking..." : "Xác nhận nhận sân"}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-500">Chọn một sân để xem thao tác vận hành.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
