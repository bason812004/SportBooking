import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  LayoutGrid,
  LogIn,
  LogOut,
  PhoneCall,
  RefreshCcw,
  TimerReset,
  Users
} from "lucide-react";
import { recipientApi, type RecipientOperationItem, type RecipientSurfaceAvailabilitySlot } from "../../features/recipient/api/recipientApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { WalkInBookingForm } from "../../features/recipient/components/WalkInBookingForm";

const statusMeta: Record<RecipientOperationItem["status"], { label: string; className: string }> = {
  AVAILABLE: { label: "Sân trống", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  OCCUPIED: { label: "Đang có khách", className: "border-blue-200 bg-blue-50 text-blue-700" },
  ENDING_SOON: { label: "Sắp hết giờ", className: "border-amber-200 bg-amber-50 text-amber-700" },
  OVERDUE: { label: "Quá giờ chưa trả sân", className: "border-red-200 bg-red-50 text-red-700" },
  RESERVED_SOON: { label: "Sắp có khách", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  INACTIVE: { label: "Tạm ngưng", className: "border-slate-200 bg-slate-100 text-slate-600" }
};

const extendOptions = [15, 30, 60];
const todayValue = () => new Date().toISOString().slice(0, 10);

function SummaryStat({
  label,
  value,
  tone,
  iconBg,
  icon: Icon
}: {
  label: string;
  value: number;
  tone: string;
  iconBg: string;
  icon: typeof Users;
}) {
  return (
    <div className="flex flex-1 items-center gap-2.5 px-3 py-2.5 first:pl-0 last:pr-0">
      <span className={`rounded-lg p-1.5 ${iconBg}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className={`text-lg font-black leading-tight ${tone}`}>{value}</p>
      </div>
    </div>
  );
}

function MiniSlotStrip({ slots, opening, closing, loading }: { slots: RecipientSurfaceAvailabilitySlot[]; opening: string; closing: string; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex h-2.5 gap-0.5">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="flex-1 animate-pulse rounded-full bg-slate-100" />
        ))}
      </div>
    );
  }
  if (!slots.length) return null;
  return (
    <div className="flex h-2.5 gap-0.5" title={`Giờ hoạt động ${opening} - ${closing}`}>
      {slots.map((slot) => (
        <div
          key={`${slot.startTime}-${slot.endTime}`}
          className={`flex-1 rounded-full ${slot.status === "BOOKED" ? "bg-rose-400" : "bg-emerald-400"}`}
          title={`${slot.startTime} - ${slot.endTime}: ${slot.status === "BOOKED" ? "Đã đặt" : "Trống"}`}
        />
      ))}
    </div>
  );
}

function SurfaceTile({
  item,
  selected,
  onSelect,
  availabilitySlots,
  availabilityLoading,
  opening,
  closing
}: {
  item: RecipientOperationItem;
  selected: boolean;
  onSelect: () => void;
  availabilitySlots?: RecipientSurfaceAvailabilitySlot[];
  availabilityLoading: boolean;
  opening: string;
  closing: string;
}) {
  const meta = statusMeta[item.status];
  const surface = item.surface;
  const preview = item.currentBooking
    ? { label: "Đang chơi", text: item.currentBooking.customerName }
    : item.status === "OVERDUE" && item.latestEndedBooking
      ? { label: "Quá giờ", text: item.latestEndedBooking.customerName }
      : item.nextBooking
        ? { label: "Sắp tới", text: `${item.nextBooking.startTime} · ${item.nextBooking.customerName}` }
        : { label: surface.status === "ACTIVE" ? "Trống" : "Tạm ngưng", text: surface.status === "ACTIVE" ? "Sẵn sàng nhận khách" : "Đang bảo trì" };
  const hasCustomerOnCourt = Boolean(item.currentBooking || (item.status === "OVERDUE" && item.latestEndedBooking));
  const customerHighlightClass =
    item.status === "OVERDUE"
      ? "border-red-200 bg-red-50 text-red-800"
      : hasCustomerOnCourt
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-slate-100 bg-slate-50 text-slate-800";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-[260px] flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
        selected ? "border-blue-500 bg-blue-50/40 ring-4 ring-blue-200" : "border-slate-200"
      }`}
    >
      <div className="relative h-28 shrink-0 bg-slate-100">
        {surface.imageUrl ? (
          <img src={surface.imageUrl} alt={surface.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        <span className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-xs font-black ${meta.className}`}>{meta.label}</span>
        {selected ? (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white shadow">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Đang chọn
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div>
          <h2 className="line-clamp-1 text-base font-black text-slate-800">{surface.name}</h2>
          <p className="text-sm font-semibold text-slate-500">Mã sân: {surface.code}</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          {surface.surface ? (
            <span className="flex items-center gap-1">
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              {surface.surface}
            </span>
          ) : null}
          {surface.capacity ? (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {surface.capacity}
            </span>
          ) : null}
        </div>
        {surface.status === "ACTIVE" ? (
          <MiniSlotStrip slots={availabilitySlots ?? []} opening={opening} closing={closing} loading={availabilityLoading} />
        ) : null}
        <div className={`mt-auto rounded-lg border px-2 py-1.5 text-sm ${customerHighlightClass}`}>
          <p className={`text-xs font-black uppercase tracking-wide ${hasCustomerOnCourt ? "text-current" : "text-slate-500"}`}>{preview.label}</p>
          <p className={`${hasCustomerOnCourt ? "mt-0.5 text-base font-black leading-tight" : "mt-0.5 font-semibold"} truncate`}>{preview.text}</p>
        </div>
      </div>
    </button>
  );
}

export function RecipientCourtSurfacesPage() {
  const queryClient = useQueryClient();
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string | null>(null);

  const operations = useQuery({
    queryKey: ["recipient-operations"],
    queryFn: () => recipientApi.operations(),
    refetchInterval: 60_000
  });

  const items = operations.data?.items ?? [];
  const selected = useMemo(
    () => items.find((item) => item.surface.id === selectedSurfaceId) ?? items[0] ?? null,
    [items, selectedSurfaceId]
  );

  const today = todayValue();
  const allSurfaceAvailability = useQueries({
    queries: items.map((item) => ({
      queryKey: ["recipient-surface-availability", item.surface.id],
      queryFn: () => recipientApi.surfaceAvailability(item.surface.id, today),
      enabled: item.surface.status === "ACTIVE",
      staleTime: 30_000
    }))
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["recipient-operations"] });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "INACTIVE" }) => recipientApi.updateCourtSurfaceStatus(id, status),
    onSuccess: () => {
      toast.success("Đã cập nhật trạng thái sân con");
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "Có lỗi xảy ra")
  });

  const extendBooking = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) => recipientApi.extendBooking(id, minutes),
    onSuccess: () => {
      toast.success("Đã gia hạn thời gian chơi cho khách");
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "Không thể gia hạn, sân đã có lịch sau đó")
  });

  const earlyCheckIn = useMutation({
    mutationFn: (bookingId: string) => recipientApi.earlyCheckInBooking(bookingId),
    onSuccess: () => {
      toast.success("Đã check-in sớm cho khách");
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "Không thể check-in sớm")
  });

  const earlyCheckOut = useMutation({
    mutationFn: (bookingId: string) => recipientApi.earlyCheckOutBooking(bookingId),
    onSuccess: () => {
      toast.success("Đã check-out cho khách");
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "Không thể check-out")
  });

  const completeOverdue = useMutation({
    mutationFn: (bookingId: string) => recipientApi.completeBooking(bookingId),
    onSuccess: () => {
      toast.success("Đã xác nhận khách trả sân");
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "Không thể xác nhận trả sân")
  });

  if (operations.isLoading) return <LoadingState />;
  if (operations.isError) return <ErrorState message={operations.error.message} onRetry={refresh} />;

  const data = operations.data!;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 p-4 text-white shadow-xl">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black">
              Quản lý sân
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100">Vận hành</span>
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Theo dõi khách đang sử dụng từng sân con của {data.court.name} - cập nhật lúc {data.nowTime} ngày{" "}
              {new Date(data.date).toLocaleDateString("vi-VN")}.
            </p>
          </div>
          <Button variant="secondary" onClick={() => refresh()}>
            <RefreshCcw className="h-4 w-4" />
            Làm mới
          </Button>
        </div>
      </section>

      <div className="flex divide-x divide-slate-200 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SummaryStat label="Đang có khách" value={data.summary.occupied} tone="text-blue-700" iconBg="bg-blue-100 text-blue-700" icon={Users} />
        <SummaryStat label="Sắp hết giờ" value={data.summary.endingSoon} tone="text-amber-700" iconBg="bg-amber-100 text-amber-700" icon={Clock} />
        <SummaryStat label="Quá giờ" value={data.summary.overdue} tone="text-red-700" iconBg="bg-red-100 text-red-700" icon={AlertTriangle} />
        <SummaryStat label="Sắp có khách" value={data.summary.reservedSoon} tone="text-indigo-700" iconBg="bg-indigo-100 text-indigo-700" icon={CalendarClock} />
        <SummaryStat label="Đang trống" value={data.summary.available} tone="text-emerald-700" iconBg="bg-emerald-100 text-emerald-700" icon={CheckCircle2} />
      </div>

      {items.length === 0 ? (
        <EmptyState title="Cơ sở chưa có sân con nào" />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid auto-rows-[260px] grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item, index) => (
              <SurfaceTile
                key={item.surface.id}
                item={item}
                selected={selected?.surface.id === item.surface.id}
                onSelect={() => setSelectedSurfaceId(item.surface.id)}
                availabilitySlots={allSurfaceAvailability[index]?.data?.slots}
                availabilityLoading={allSurfaceAvailability[index]?.isLoading ?? false}
                opening={allSurfaceAvailability[index]?.data?.openingTime ?? "06:00"}
                closing={allSurfaceAvailability[index]?.data?.closingTime ?? "23:00"}
              />
            ))}
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-3.5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto">
            {selected ? (
              <div className="space-y-2.5">
                <div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusMeta[selected.status].className}`}>
                    {statusMeta[selected.status].label}
                  </span>
                </div>

                {selected.status === "OVERDUE" && selected.latestEndedBooking ? (
                  <div className="space-y-2.5">
                    <div className="rounded-xl border border-red-100 bg-red-50/70 p-2.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-red-700">Khách đã quá giờ</p>
                      <p className="mt-1 font-black text-slate-800">{selected.latestEndedBooking.customerName}</p>
                      {selected.latestEndedBooking.customerPhone ? (
                        <p className="flex items-center gap-1 text-sm text-slate-600">
                          <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                          {selected.latestEndedBooking.customerPhone}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-slate-600">
                        Lịch cũ: {selected.latestEndedBooking.startTime} - {selected.latestEndedBooking.endTime}
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-black text-slate-500">Khách muốn chơi tiếp</p>
                      <div className="flex flex-wrap gap-2">
                        {extendOptions.map((minutes) => (
                          <Button
                            key={minutes}
                            variant="secondary"
                            disabled={extendBooking.isPending}
                            onClick={() => extendBooking.mutate({ id: selected.latestEndedBooking!.id, minutes })}
                          >
                            <TimerReset className="h-4 w-4" />+{minutes} phút
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Button className="w-full" variant="danger" disabled={completeOverdue.isPending} onClick={() => completeOverdue.mutate(selected.latestEndedBooking!.id)}>
                      <LogOut className="h-4 w-4" />
                      {completeOverdue.isPending ? "Đang xác nhận..." : "Xác nhận trả sân"}
                    </Button>
                  </div>
                ) : selected.currentBooking ? (
                  <div className="space-y-2.5">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Khách đang chơi</p>
                      <p className="mt-1 font-black text-slate-800">{selected.currentBooking.customerName}</p>
                      {selected.currentBooking.customerPhone ? (
                        <p className="flex items-center gap-1 text-sm text-slate-600">
                          <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                          {selected.currentBooking.customerPhone}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-slate-600">
                        {selected.currentBooking.startTime} - {selected.currentBooking.endTime}
                        {selected.minutesLeft != null && selected.minutesLeft > 0 ? <span className="ml-1 font-semibold text-amber-700">(còn {selected.minutesLeft} phút)</span> : null}
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-black text-slate-500">Gia hạn thời gian chơi</p>
                      <div className="flex flex-wrap gap-2">
                        {extendOptions.map((minutes) => (
                          <Button
                            key={minutes}
                            variant="secondary"
                            disabled={!selected.canExtend || extendBooking.isPending}
                            onClick={() => extendBooking.mutate({ id: selected.currentBooking!.id, minutes })}
                          >
                            <TimerReset className="h-4 w-4" />+{minutes} phút
                          </Button>
                        ))}
                      </div>
                      {!selected.canExtend && <p className="mt-2 text-sm font-semibold text-amber-700">Sân đã có lịch đặt ngay sau đó, không thể gia hạn.</p>}
                    </div>

                    <Button className="w-full" variant="secondary" disabled={earlyCheckOut.isPending} onClick={() => earlyCheckOut.mutate(selected.currentBooking!.id)}>
                      <LogOut className="h-4 w-4" />
                      {earlyCheckOut.isPending ? "Đang check-out..." : "Check-out"}
                    </Button>
                  </div>
                ) : selected.nextBooking ? (
                  <div className="space-y-2.5">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Khách sắp nhận sân</p>
                      <p className="mt-1 font-black text-slate-800">{selected.nextBooking.customerName}</p>
                      <p className="text-sm text-slate-600">
                        {selected.nextBooking.startTime} - {selected.nextBooking.endTime}
                      </p>
                    </div>
                    <Button className="w-full" variant="secondary" disabled={earlyCheckIn.isPending} onClick={() => earlyCheckIn.mutate(selected.nextBooking!.id)}>
                      <LogIn className="h-4 w-4" />
                      {earlyCheckIn.isPending ? "Đang check-in..." : "Check-in sớm"}
                    </Button>
                  </div>
                ) : null}

                {!selected.currentBooking && selected.surface.status === "ACTIVE" ? (
                  <WalkInBookingForm key={selected.surface.id} courtSurfaceId={selected.surface.id} onBookingCreated={refresh} />
                ) : null}

                <Button
                  className="w-full"
                  variant={selected.surface.status === "ACTIVE" ? "danger" : "secondary"}
                  disabled={toggleStatus.isPending}
                  onClick={() =>
                    toggleStatus.mutate({
                      id: selected.surface.id,
                      status: selected.surface.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                    })
                  }
                >
                  {selected.surface.status === "ACTIVE" ? "Tạm ngưng sân" : "Kích hoạt lại"}
                </Button>
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-500">Chọn một sân con để xem chi tiết.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
