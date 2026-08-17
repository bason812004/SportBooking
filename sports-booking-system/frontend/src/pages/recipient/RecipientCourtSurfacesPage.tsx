import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  PhoneCall,
  RefreshCcw,
  TimerReset,
  Users
} from "lucide-react";
import { recipientApi, type RecipientOperationItem } from "../../features/recipient/api/recipientApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { Button } from "../../components/ui/Button";
import { useWalkInBooking, WalkInDetailsFields } from "../../features/recipient/components/WalkInBookingForm";
import { StaffScheduleGrid } from "../../features/recipient/components/StaffScheduleGrid";

const statusMeta: Record<RecipientOperationItem["status"], { label: string; className: string; dotClassName: string }> = {
  AVAILABLE: { label: "Sân trống", className: "border-emerald-200 bg-emerald-50 text-emerald-700", dotClassName: "bg-emerald-500" },
  OCCUPIED: { label: "Đang có khách", className: "border-blue-200 bg-blue-50 text-blue-700", dotClassName: "bg-blue-500" },
  ENDING_SOON: { label: "Sắp hết giờ", className: "border-amber-200 bg-amber-50 text-amber-700", dotClassName: "bg-amber-500" },
  OVERDUE: { label: "Quá giờ chưa trả sân", className: "border-red-200 bg-red-50 text-red-700", dotClassName: "bg-red-500" },
  RESERVED_SOON: { label: "Sắp có khách", className: "border-indigo-200 bg-indigo-50 text-indigo-700", dotClassName: "bg-indigo-500" },
  INACTIVE: { label: "Tạm ngưng", className: "border-slate-200 bg-slate-100 text-slate-600", dotClassName: "bg-slate-400" }
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

function SurfaceTile({
  item,
  selected,
  onSelect
}: {
  item: RecipientOperationItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = statusMeta[item.status];
  const surface = item.surface;
  const preview = item.currentBooking
    ? item.currentBooking.customerName
    : item.status === "OVERDUE" && item.latestEndedBooking
      ? item.latestEndedBooking.customerName
      : item.nextBooking
        ? `${item.nextBooking.startTime} · ${item.nextBooking.customerName}`
        : surface.status === "ACTIVE"
          ? "Sẵn sàng nhận khách"
          : "Đang bảo trì";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-52 shrink-0 items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition hover:shadow-md ${
        selected ? "border-blue-500 bg-blue-50/60 ring-4 ring-blue-200" : "border-slate-200"
      }`}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dotClassName}`} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-black text-slate-800">{surface.name}</h2>
        <p className="truncate text-xs font-semibold text-slate-500">{preview}</p>
      </div>
      {selected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" /> : null}
    </button>
  );
}

function SurfaceSchedule({ courtSurfaceId, surfaceStatus }: { courtSurfaceId: string; surfaceStatus: "ACTIVE" | "INACTIVE" }) {
  const today = todayValue();
  const availability = useQuery({
    queryKey: ["recipient-surface-availability", courtSurfaceId, today],
    queryFn: () => recipientApi.surfaceAvailability(courtSurfaceId, today),
    enabled: surfaceStatus === "ACTIVE",
    staleTime: 30_000
  });

  if (surfaceStatus !== "ACTIVE") {
    return <p className="text-sm font-semibold text-slate-500">Sân đang tạm ngưng, không có khung giờ để hiển thị.</p>;
  }

  if (availability.isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  const slots = availability.data?.slots ?? [];
  if (!slots.length) {
    return <p className="text-sm font-semibold text-slate-500">Chưa có khung giờ nào cho hôm nay.</p>;
  }

  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">
        Giờ hoạt động {availability.data?.openingTime} - {availability.data?.closingTime}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((slot) => (
          <div
            key={`${slot.startTime}-${slot.endTime}`}
            className={`rounded-lg border px-2 py-1.5 text-center text-xs font-bold ${
              slot.status === "BOOKED" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {slot.startTime} - {slot.endTime}
          </div>
        ))}
      </div>
    </div>
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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["recipient-operations"] });
    queryClient.invalidateQueries({ queryKey: ["recipient-surface-availability"] });
  };

  const [walkInDate, setWalkInDate] = useState(todayValue());
  useEffect(() => {
    setWalkInDate(todayValue());
  }, [selected?.surface.id]);

  const canBookAdvance = Boolean(selected && selected.surface.status === "ACTIVE");
  const surfaceNames = useMemo(() => Object.fromEntries(items.map((item) => [item.surface.id, item.surface.name])), [items]);
  const walkIn = useWalkInBooking({
    courtSurfaceId: canBookAdvance ? selected!.surface.id : "",
    bookingDate: walkInDate,
    onBookingCreated: refresh,
    enableCustomerLookup: true,
    surfaceNames,
    depositPercent: canBookAdvance ? selected!.surface.depositPercent : undefined
  });

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
    mutationFn: (bookingId: string) => recipientApi.checkInBooking(bookingId),
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
      <PageHero
        eyebrow="Vận hành"
        title="Đặt sân tại quầy"
        subtitle={`Theo dõi khách đang sử dụng từng sân con của ${data.court.name} - cập nhật lúc ${data.nowTime} ngày ${new Date(data.date).toLocaleDateString("vi-VN")}.`}
        actions={
          <Button variant="secondary" onClick={() => refresh()}>
            <RefreshCcw className="h-4 w-4" />
            Làm mới
          </Button>
        }
      />

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
        <div className="space-y-5">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {items.map((item) => (
              <SurfaceTile
                key={item.surface.id}
                item={item}
                selected={selected?.surface.id === item.surface.id}
                onSelect={() => setSelectedSurfaceId(item.surface.id)}
              />
            ))}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            {selected ? (
              <div className="grid gap-6 lg:grid-cols-7">
                <div className="lg:col-span-5">
                  {canBookAdvance ? (
                    <StaffScheduleGrid
                      courtSurfaceId={selected.surface.id}
                      surfaceName={selected.surface.name}
                      bookingDate={walkInDate}
                      onDateChange={setWalkInDate}
                      walkIn={walkIn}
                    />
                  ) : (
                    <>
                      <p className="mb-3 text-sm font-black text-slate-700">
                        Khung giờ ngày {new Date(walkInDate).toLocaleDateString("vi-VN")} - {selected.surface.name}
                      </p>
                      <SurfaceSchedule courtSurfaceId={selected.surface.id} surfaceStatus={selected.surface.status} />
                    </>
                  )}
                </div>

                <div className="space-y-2.5 lg:col-span-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusMeta[selected.status].className}`}>
                    {statusMeta[selected.status].label}
                  </span>

                  <div className="space-y-2.5">
                    {selected.status === "OVERDUE" && selected.latestEndedBooking ? (
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
                    ) : selected.currentBooking ? (
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
                    ) : selected.nextBooking ? (
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Khách sắp nhận sân</p>
                        <p className="mt-1 font-black text-slate-800">{selected.nextBooking.customerName}</p>
                        <p className="text-sm text-slate-600">
                          {selected.nextBooking.startTime} - {selected.nextBooking.endTime}
                        </p>
                      </div>
                    ) : selected.surface.status !== "ACTIVE" ? (
                      <p className="text-sm font-semibold text-slate-500">Sân đang tạm ngưng hoạt động.</p>
                    ) : null}
                  </div>

                  <div className="space-y-2.5">
                    {selected.status === "OVERDUE" && selected.latestEndedBooking ? (
                      <>
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
                      </>
                    ) : selected.currentBooking && !selected.currentBooking.checkedInAt ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="mb-2 text-sm font-bold text-amber-800">Khách đã tới giờ nhưng chưa check-in — hãy xác nhận để bắt đầu bán dịch vụ cho sân này.</p>
                        <Button className="w-full" disabled={earlyCheckIn.isPending} onClick={() => earlyCheckIn.mutate(selected.currentBooking!.id)}>
                          <LogIn className="h-4 w-4" />
                          {earlyCheckIn.isPending ? "Đang check-in..." : "Check-in"}
                        </Button>
                      </div>
                    ) : selected.currentBooking ? (
                      <>
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
                      </>
                    ) : selected.nextBooking ? (
                      <Button className="w-full" variant="secondary" disabled={earlyCheckIn.isPending} onClick={() => earlyCheckIn.mutate(selected.nextBooking!.id)}>
                        <LogIn className="h-4 w-4" />
                        {earlyCheckIn.isPending ? "Đang check-in..." : "Check-in sớm"}
                      </Button>
                    ) : null}

                    {canBookAdvance ? (
                      <div className="space-y-2">
                        <p className="text-sm font-black text-slate-500">Đặt sân cho khách</p>
                        <WalkInDetailsFields walkIn={walkIn} />
                      </div>
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
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm font-semibold text-slate-500">Chọn một sân con để xem chi tiết.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
