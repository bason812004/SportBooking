import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { recipientApi, type RecipientWalkInPayment } from "../api/recipientApi";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SlotGrid, type SlotGridSelection } from "../../../components/booking/SlotGrid";
import { QrPaymentPanel } from "../../../components/payment/QrPaymentPanel";
import { PlusCircle, X } from "lucide-react";

const paymentDoneStatuses = ["PAID", "FAILED", "EXPIRED", "CANCELLED"];
const todayValue = () => new Date().toISOString().slice(0, 10);
const nowValue = () => new Date().toTimeString().slice(0, 5);

type WalkInForm = {
  customerName: string;
  customerPhone: string;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "E_WALLET";
  note: string;
};

const defaultWalkInForm = (): WalkInForm => ({
  customerName: "",
  customerPhone: "",
  paymentMethod: "CASH",
  note: ""
});

function toggleContiguousSlot(current: SlotGridSelection[], slot: SlotGridSelection): SlotGridSelection[] {
  if (current.length === 0) return [slot];
  const sorted = [...current].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (slot.startTime === last.endTime) return [...sorted, slot];
  if (slot.endTime === first.startTime) return [slot, ...sorted];
  if (slot.startTime === last.startTime) return sorted.slice(0, -1);
  if (slot.startTime === first.startTime && sorted.length > 1) return sorted.slice(1);
  return [slot];
}

export function WalkInBookingForm({
  courtSurfaceId,
  bookingDate,
  initialSlot,
  onBookingCreated,
  onSettled
}: {
  courtSurfaceId: string;
  /** Date to book for. Defaults to today (the usual walk-in-at-the-counter case). */
  bookingDate?: string;
  initialSlot?: SlotGridSelection;
  /** Fired as soon as the booking row exists (before payment is confirmed) — use to refresh list queries. */
  onBookingCreated?: () => void;
  /** Fired once the whole flow is done (cash/e-wallet immediately, bank transfer after payment confirmed) — use to close a modal. */
  onSettled?: () => void;
}) {
  const effectiveDate = bookingDate ?? todayValue();
  const isToday = effectiveDate === todayValue();
  const [walkInForm, setWalkInForm] = useState<WalkInForm>(defaultWalkInForm());
  const [walkInSlots, setWalkInSlots] = useState<SlotGridSelection[]>(initialSlot ? [initialSlot] : []);
  const [activeWalkInPayment, setActiveWalkInPayment] = useState<RecipientWalkInPayment | null>(null);

  useEffect(() => {
    setWalkInSlots(initialSlot ? [initialSlot] : []);
    setActiveWalkInPayment(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtSurfaceId, effectiveDate]);

  const surfaceAvailability = useQuery({
    queryKey: ["recipient-surface-availability", courtSurfaceId, effectiveDate],
    queryFn: () => recipientApi.surfaceAvailability(courtSurfaceId, effectiveDate)
  });

  const walkInPaymentStatus = useQuery({
    queryKey: ["recipient-payment-status", activeWalkInPayment?.id],
    queryFn: () => recipientApi.paymentStatus(activeWalkInPayment!.id),
    enabled: Boolean(activeWalkInPayment),
    refetchInterval: (query) => {
      const current = query.state.data?.status;
      return current && paymentDoneStatuses.includes(current) ? false : 2500;
    }
  });

  const createWalkIn = useMutation({
    mutationFn: () => {
      if (walkInSlots.length === 0) throw new Error("Chọn ít nhất một khung giờ");
      const sortedSlots = [...walkInSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
      return recipientApi.createWalkInBooking({
        courtSurfaceId,
        customerName: walkInForm.customerName,
        customerPhone: walkInForm.customerPhone,
        bookingDate: effectiveDate,
        startTime: sortedSlots[0].startTime,
        minutes: sortedSlots.length * 60,
        paymentMethod: walkInForm.paymentMethod,
        note: walkInForm.note || undefined
      });
    },
    onSuccess: (result) => {
      setWalkInSlots([]);
      onBookingCreated?.();
      if (result.payment) {
        setActiveWalkInPayment(result.payment);
      } else {
        toast.success("Đã tạo booking tại quầy cho khách");
        setWalkInForm(defaultWalkInForm());
        onSettled?.();
      }
    },
    onError: (error: any) => toast.error(error.message || "Không thể tạo booking, khung giờ đã có khách khác")
  });

  const confirmWalkInPayment = useMutation({
    mutationFn: (paymentId: string) => recipientApi.confirmPayment(paymentId),
    onSuccess: () => {
      toast.success("Đã xác nhận thanh toán chuyển khoản");
      setActiveWalkInPayment(null);
      setWalkInForm(defaultWalkInForm());
      onBookingCreated?.();
      onSettled?.();
    },
    onError: (error: any) => toast.error(error.message || "Không thể xác nhận thanh toán")
  });

  useEffect(() => {
    if (walkInPaymentStatus.data?.status === "PAID") {
      toast.success("Đã nhận được thanh toán chuyển khoản");
      setActiveWalkInPayment(null);
      setWalkInForm(defaultWalkInForm());
      onBookingCreated?.();
      onSettled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkInPaymentStatus.data?.status]);

  if (activeWalkInPayment) {
    return (
      <div className="space-y-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
            <PlusCircle className="h-3.5 w-3.5" />
            Chờ khách chuyển khoản
          </p>
          <button type="button" onClick={() => setActiveWalkInPayment(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>
        <QrPaymentPanel
          payment={{
            id: activeWalkInPayment.id,
            provider: activeWalkInPayment.provider,
            qrCodeUrl: activeWalkInPayment.qrCodeUrl,
            qrPayload: activeWalkInPayment.qrPayload,
            paymentReference: activeWalkInPayment.paymentReference,
            amount: activeWalkInPayment.amount,
            expiresAt: walkInPaymentStatus.data?.expiresAt ?? activeWalkInPayment.expiresAt
          }}
        />
        <Button className="w-full" disabled={confirmWalkInPayment.isPending} onClick={() => confirmWalkInPayment.mutate(activeWalkInPayment.id)}>
          {confirmWalkInPayment.isPending ? "Đang xác nhận..." : "Xác nhận đã nhận tiền"}
        </Button>
      </div>
    );
  }

  return (
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

      <div>
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Chọn khung giờ</span>
        <div className="max-h-56 overflow-y-auto pr-1">
          <SlotGrid
            slots={surfaceAvailability.data?.slots ?? []}
            selected={walkInSlots}
            opening={surfaceAvailability.data?.openingTime ?? "06:00"}
            closing={surfaceAvailability.data?.closingTime ?? "23:00"}
            minStartTime={isToday ? nowValue() : undefined}
            onToggle={(slot) => setWalkInSlots((current) => toggleContiguousSlot(current, slot))}
            loading={surfaceAvailability.isLoading}
            minPrice={0}
            columnsClassName="grid-cols-3"
          />
        </div>
        {walkInSlots.length > 0 ? (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-xs">
            <span className="font-bold text-slate-700">
              {[...walkInSlots].sort((a, b) => a.startTime.localeCompare(b.startTime))[0].startTime} -{" "}
              {[...walkInSlots].sort((a, b) => a.startTime.localeCompare(b.startTime))[walkInSlots.length - 1].endTime} ({walkInSlots.length} giờ)
            </span>
            <button type="button" onClick={() => setWalkInSlots([])} className="font-bold text-rose-600">
              Bỏ chọn
            </button>
          </div>
        ) : null}
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
      <Button className="w-full" disabled={createWalkIn.isPending || walkInSlots.length === 0}>
        {createWalkIn.isPending ? "Đang tạo..." : "Xác nhận nhận sân"}
      </Button>
    </form>
  );
}
