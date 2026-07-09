import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Grid2X2, PauseCircle, RefreshCcw, UserRoundCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import {
  recipientApi,
  type RecipientOperationItem,
  type RecipientWalkInBookingPayload
} from "../../features/recipient/api/recipientApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";

const fallbackImages = [
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80"
];

const statusCopy: Record<RecipientOperationItem["status"], { label: string; tone: string; message: string }> = {
  AVAILABLE: { label: "Sân trống", tone: "emerald", message: "Sân đang trống, sẵn sàng nhận khách." },
  OCCUPIED: { label: "Đang chơi", tone: "blue", message: "Khách đang sử dụng sân." },
  ENDING_SOON: { label: "Sắp hết giờ", tone: "amber", message: "Khách sắp hết giờ, kiểm tra nhu cầu chơi tiếp." },
  OVERDUE: { label: "Quá giờ", tone: "red", message: "Khách đã quá giờ, cần xử lý trả sân hoặc gia hạn." },
  RESERVED_SOON: { label: "Sắp có khách", tone: "indigo", message: "Sân sắp có khách đặt tiếp theo." },
  INACTIVE: { label: "Tạm ngưng", tone: "slate", message: "Sân đang tạm ngưng nhận khách." }
};

type WalkInForm = {
  customerName: string;
  customerPhone: string;
  startTime: string;
  minutes: string;
  paymentMethod: RecipientWalkInBookingPayload["paymentMethod"];
  note: string;
};

const defaultForm = (): WalkInForm => ({
  customerName: "",
  customerPhone: "",
  startTime: currentTime(),
  minutes: "60",
  paymentMethod: "CASH",
  note: ""
});

export function RecipientCourtSurfacesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<WalkInForm>(defaultForm);

  const operations = useQuery({
    queryKey: ["recipient-operations"],
    queryFn: () => recipientApi.operations()
  });

  const selected = useMemo(() => {
    const items = operations.data?.items ?? [];
    return items.find((item) => item.surface.id === selectedId) ?? items[0] ?? null;
  }, [operations.data?.items, selectedId]);

  const createWalkIn = useMutation({
    mutationFn: (payload: RecipientWalkInBookingPayload) => recipientApi.createWalkInBooking(payload),
    onSuccess: async () => {
      toast.success("Đã tạo booking tại quầy");
      setForm(defaultForm());
      await queryClient.invalidateQueries({ queryKey: ["recipient-operations"] });
    },
    onError: (error) => toast.error(error.message)
  });

  const extendBooking = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) => recipientApi.extendBooking(id, minutes),
    onSuccess: async () => {
      toast.success("Đã gia hạn sân");
      await queryClient.invalidateQueries({ queryKey: ["recipient-operations"] });
    },
    onError: (error) => toast.error(error.message)
  });

  const updateSurfaceStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "INACTIVE" }) => recipientApi.updateCourtSurfaceStatus(id, status),
    onSuccess: async () => {
      toast.success("Đã cập nhật trạng thái sân");
      await queryClient.invalidateQueries({ queryKey: ["recipient-operations"] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (operations.isLoading) return <LoadingState />;
  if (operations.isError) return <ErrorState message={operations.error.message} />;

  const items = operations.data?.items ?? [];
  const summary = operations.data?.summary;

  const submitWalkIn = () => {
    if (!selected) return;
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      toast.error("Vui lòng nhập tên khách và số điện thoại");
      return;
    }
    createWalkIn.mutate({
      courtSurfaceId: selected.surface.id,
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      bookingDate: operations.data?.date ?? today(),
      startTime: toTimeWithSeconds(form.startTime),
      minutes: Number(form.minutes),
      paymentMethod: form.paymentMethod,
      note: form.note.trim() || undefined
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Sân con</h1>
          <p className="text-sm text-slate-600">
            Theo dõi khách đang sử dụng từng sân con của {operations.data?.court.name ?? "cơ sở"} - cập nhật lúc {formatTime(operations.data?.nowTime)} ngày {formatDate(operations.data?.date)}.
          </p>
        </div>
        <Button variant="secondary" onClick={() => operations.refetch()}>
          <RefreshCcw className="h-4 w-4" />
          Làm mới
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Đang có khách" value={summary?.occupied ?? 0} tone="blue" />
        <SummaryCard label="Sắp hết giờ" value={summary?.endingSoon ?? 0} tone="amber" />
        <SummaryCard label="Quá giờ" value={summary?.overdue ?? 0} tone="red" />
        <SummaryCard label="Sắp có khách" value={summary?.reservedSoon ?? 0} tone="indigo" />
        <SummaryCard label="Đang trống" value={summary?.available ?? 0} tone="emerald" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid auto-rows-fr gap-4 lg:grid-cols-3">
          {items.map((item, index) => (
            <SurfaceCard
              key={item.surface.id}
              item={item}
              image={item.surface.imageUrl || fallbackImages[index % fallbackImages.length]}
              selected={selected?.surface.id === item.surface.id}
              onSelect={() => setSelectedId(item.surface.id)}
            />
          ))}
        </div>

        <aside className="space-y-4 rounded-lg border bg-white p-5 xl:sticky xl:top-5 xl:self-start">
          {selected ? (
            <>
              <StatusPill status={selected.status} />
              <div>
                <h2 className="text-2xl font-bold">{selected.surface.name}</h2>
                <p className="text-sm text-slate-600">Mã sân: {selected.surface.code}</p>
              </div>
              <p className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                {statusCopy[selected.status].message}
              </p>

              {selected.currentBooking && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-black uppercase text-blue-700">Khách đang chơi</p>
                  <p className="mt-1 text-xl font-black text-blue-900">{selected.currentBooking.customerName}</p>
                  <p className="mt-1 text-sm text-blue-700">
                    {formatTime(selected.currentBooking.startTime)} - {formatTime(selected.currentBooking.endTime)}
                    {selected.minutesLeft !== null ? ` · còn ${Math.max(selected.minutesLeft, 0)} phút` : ""}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={!selected.canExtend || extendBooking.isPending}
                      onClick={() => extendBooking.mutate({ id: selected.currentBooking!.id, minutes: 30 })}
                    >
                      Gia hạn 30 phút
                    </Button>
                  </div>
                </div>
              )}

              {selected.nextBooking && (
                <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                  <p className="font-bold">Khách tiếp theo</p>
                  <p>{selected.nextBooking.customerName} · {formatTime(selected.nextBooking.startTime)} - {formatTime(selected.nextBooking.endTime)}</p>
                </div>
              )}

              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                <h3 className="font-bold text-emerald-800">Đặt sân tại quầy</h3>
                <div className="mt-3 grid gap-3">
                  <Input label="Tên khách" value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} />
                  <Input label="Số điện thoại" value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Bắt đầu" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
                    <Select
                      label="Thời lượng"
                      value={form.minutes}
                      onChange={(event) => setForm({ ...form, minutes: event.target.value })}
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
                    value={form.paymentMethod}
                    onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as WalkInForm["paymentMethod"] })}
                    options={[
                      { value: "CASH", label: "Tiền mặt" },
                      { value: "BANK_TRANSFER", label: "Chuyển khoản" },
                      { value: "E_WALLET", label: "Ví điện tử" }
                    ]}
                  />
                  <Input label="Ghi chú" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
                  <Button disabled={createWalkIn.isPending || selected.status === "INACTIVE"} onClick={submitWalkIn}>
                    <UserRoundCheck className="h-4 w-4" />
                    Xác nhận nhận sân
                  </Button>
                </div>
              </div>

              <Button
                className="w-full"
                variant={selected.surface.status === "ACTIVE" ? "danger" : "secondary"}
                disabled={updateSurfaceStatus.isPending}
                onClick={() => updateSurfaceStatus.mutate({ id: selected.surface.id, status: selected.surface.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
              >
                <PauseCircle className="h-4 w-4" />
                {selected.surface.status === "ACTIVE" ? "Tạm ngưng sân" : "Mở lại sân"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-slate-500">Chưa có sân con để vận hành.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function SurfaceCard({ item, image, selected, onSelect }: { item: RecipientOperationItem; image: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[260px] flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selected ? "border-blue-500 ring-2 ring-blue-200" : "border-line"}`}
    >
      <div className="relative h-28 overflow-hidden">
        <img className="h-full w-full object-cover" src={image} alt={item.surface.name} />
        <div className="absolute left-3 top-3">
          <StatusPill status={item.status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div>
          <h3 className="line-clamp-1 text-lg font-black">{item.surface.name}</h3>
          <p className="text-sm text-slate-600">Mã sân: {item.surface.code}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1"><Grid2X2 className="h-3.5 w-3.5" />{item.surface.surface || "Mặt sân"}</span>
          <span className="inline-flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" />{item.surface.capacity || "Sức chứa"}</span>
        </div>
        <div className={`mt-auto rounded-lg p-3 ${item.currentBooking ? "border border-blue-200 bg-blue-50" : "bg-slate-50"}`}>
          {item.currentBooking ? (
            <>
              <p className="text-xs font-black uppercase text-blue-700">Đang chơi</p>
              <p className="truncate text-lg font-black text-blue-900">{item.currentBooking.customerName}</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{statusCopy[item.status].label}</p>
              <p className="text-sm">Sẵn sàng nhận khách</p>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: RecipientOperationItem["status"] }) {
  const copy = statusCopy[status];
  const classes: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200"
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${classes[copy.tone]}`}><Clock3 className="h-3.5 w-3.5" />{copy.label}</span>;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-700",
    amber: "text-amber-700",
    red: "text-red-700",
    indigo: "text-indigo-700",
    emerald: "text-emerald-700"
  };
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className={`mt-3 text-2xl font-black ${colors[tone]}`}>{value}</p>
    </div>
  );
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toTimeWithSeconds(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : "--:--";
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "--/--/----";
}
