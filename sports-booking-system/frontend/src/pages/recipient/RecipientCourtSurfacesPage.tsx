import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  LayoutGrid,
  LogIn,
  LogOut,
  PhoneCall,
  PlusCircle,
  TimerReset,
  Users
} from "lucide-react";
import { recipientApi, type RecipientOperationItem } from "../../features/recipient/api/recipientApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

const statusMeta: Record<RecipientOperationItem["status"], { label: string; className: string }> = {
  AVAILABLE: { label: "Sân trống", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  OCCUPIED: { label: "Đang có khách", className: "border-blue-200 bg-blue-50 text-blue-700" },
  ENDING_SOON: { label: "Sắp hết giờ", className: "border-amber-200 bg-amber-50 text-amber-700" },
  OVERDUE: { label: "Quá giờ chưa trả sân", className: "border-red-200 bg-red-50 text-red-700" },
  RESERVED_SOON: { label: "Sắp có khách", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  INACTIVE: { label: "Tạm ngưng", className: "border-slate-200 bg-slate-100 text-slate-600" }
};

const extendOptions = [15, 30, 60];
const nowValue = () => new Date().toTimeString().slice(0, 5);
const todayValue = () => new Date().toISOString().slice(0, 10);

type WalkInForm = {
  customerName: string;
  customerPhone: string;
  startTime: string;
  minutes: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "E_WALLET";
  note: string;
};

const defaultWalkInForm = (): WalkInForm => ({
  customerName: "",
  customerPhone: "",
  startTime: nowValue(),
  minutes: 60,
  paymentMethod: "CASH",
  note: ""
});

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function SurfaceTile({ item, selected, onSelect }: { item: RecipientOperationItem; selected: boolean; onSelect: () => void }) {
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
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"
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
  const [walkInForm, setWalkInForm] = useState<WalkInForm>(defaultWalkInForm());

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

  const createWalkIn = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Chọn sân con trước khi đặt nhanh");
      return recipientApi.createWalkInBooking({
        courtSurfaceId: selected.surface.id,
        customerName: walkInForm.customerName,
        customerPhone: walkInForm.customerPhone,
        bookingDate: todayValue(),
        startTime: walkInForm.startTime,
        minutes: walkInForm.minutes,
        paymentMethod: walkInForm.paymentMethod,
        note: walkInForm.note || undefined
      });
    },
    onSuccess: () => {
      toast.success("Đã tạo booking tại quầy cho khách");
      setWalkInForm(defaultWalkInForm());
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "Không thể tạo booking, khung giờ đã có khách khác")
  });

  if (operations.isLoading) return <LoadingState />;
  if (operations.isError) return <ErrorState message={operations.error.message} onRetry={refresh} />;

  const data = operations.data!;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Sân con</h1>
          <p className="text-slate-600">
            Theo dõi khách đang sử dụng từng sân con của {data.court.name} - cập nhật lúc {data.nowTime} ngày{" "}
            {new Date(data.date).toLocaleDateString("vi-VN")}.
          </p>
        </div>
        <Button variant="secondary" onClick={() => refresh()}>
          Làm mới
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="Đang có khách" value={data.summary.occupied} tone="text-blue-700" />
        <SummaryCard label="Sắp hết giờ" value={data.summary.endingSoon} tone="text-amber-700" />
        <SummaryCard label="Quá giờ" value={data.summary.overdue} tone="text-red-700" />
        <SummaryCard label="Sắp có khách" value={data.summary.reservedSoon} tone="text-indigo-700" />
        <SummaryCard label="Đang trống" value={data.summary.available} tone="text-emerald-700" />
      </div>

      {items.length === 0 ? (
        <EmptyState title="Cơ sở chưa có sân con nào" />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid auto-rows-[260px] grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <SurfaceTile key={item.surface.id} item={item} selected={selected?.surface.id === item.surface.id} onSelect={() => setSelectedSurfaceId(item.surface.id)} />
            ))}
          </div>

          <aside className="h-max rounded-2xl border border-slate-200 bg-white p-4 xl:sticky xl:top-4">
            {selected ? (
              <div className="space-y-3">
                <div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusMeta[selected.status].className}`}>
                    {statusMeta[selected.status].label}
                  </span>
                  <h2 className="mt-2 text-2xl font-black text-slate-800">{selected.surface.name}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Mã sân: {selected.surface.code}</p>
                </div>

                {selected.status === "OVERDUE" && selected.latestEndedBooking ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-red-100 bg-red-50/70 p-3">
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
                  <div className="space-y-3">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
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
                  <div className="space-y-3">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
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
                ) : (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5 text-sm font-semibold text-emerald-700">
                    Sân đang trống, chưa có khách đặt tiếp theo hôm nay.
                  </div>
                )}

                {!selected.currentBooking && selected.surface.status === "ACTIVE" ? (
                  <form
                    className="space-y-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      createWalkIn.mutate();
                    }}
                  >
                    <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                      <PlusCircle className="h-3.5 w-3.5" />
                      Đặt sân tại quầy
                    </p>
                    <Input label="Tên khách" value={walkInForm.customerName} onChange={(event) => setWalkInForm({ ...walkInForm, customerName: event.target.value })} required />
                    <Input label="Số điện thoại" value={walkInForm.customerPhone} onChange={(event) => setWalkInForm({ ...walkInForm, customerPhone: event.target.value })} required />
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Bắt đầu" type="time" value={walkInForm.startTime} onChange={(event) => setWalkInForm({ ...walkInForm, startTime: event.target.value })} required />
                      <Select
                        label="Thời lượng"
                        value={String(walkInForm.minutes)}
                        onChange={(event) => setWalkInForm({ ...walkInForm, minutes: Number(event.target.value) })}
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
                      value={walkInForm.paymentMethod}
                      onChange={(event) => setWalkInForm({ ...walkInForm, paymentMethod: event.target.value as WalkInForm["paymentMethod"] })}
                      options={[
                        { value: "CASH", label: "Tiền mặt" },
                        { value: "BANK_TRANSFER", label: "Chuyển khoản" },
                        { value: "E_WALLET", label: "Ví điện tử" }
                      ]}
                    />
                    <Input label="Ghi chú" value={walkInForm.note} onChange={(event) => setWalkInForm({ ...walkInForm, note: event.target.value })} />
                    <Button className="w-full" disabled={createWalkIn.isPending}>
                      {createWalkIn.isPending ? "Đang tạo..." : "Xác nhận nhận sân"}
                    </Button>
                  </form>
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
