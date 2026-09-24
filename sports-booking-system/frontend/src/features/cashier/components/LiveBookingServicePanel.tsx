import { useNavigate } from "react-router-dom";
import { Check, CreditCard, Minus, Plus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ErrorState, LoadingState } from "../../../components/common/States";
import { BookingServiceSelector } from "../../services/components/BookingServiceSelector";
import { formatMoney } from "../../../utils/formatters";
import { useLiveBookingServices } from "../hooks/useLiveBookingServices";

type LiveServices = ReturnType<typeof useLiveBookingServices>;

/**
 * The two halves below take the hook's result as a prop rather than calling it themselves: the
 * optimistic overlay lives in the hook's local state, so a second call would give the bill its own
 * copy and leave it a full round-trip behind every click. Callers that show both halves in
 * different layout columns must lift `useLiveBookingServices` and share the one result.
 */
export function LiveBookingServiceCatalog({ services }: { services: LiveServices }) {
  const { detail, isLoading, isError, error, refetch, selectedServices, updateQuantity, clearServices } = services;

  if (isLoading) return <LoadingState />;
  if (isError || !detail) {
    return <ErrorState message={(error as Error)?.message || "Không tải được hóa đơn của khách"} onRetry={refetch} />;
  }

  return (
    <BookingServiceSelector
      courtId={detail.booking.court.id}
      selectedServices={selectedServices}
      onUpdateQuantity={updateQuantity}
      onClearServices={clearServices}
      maxRows={2}
    />
  );
}

export function LiveBookingBillSummary({
  bookingId,
  services,
  onDone
}: {
  bookingId: string;
  services: LiveServices;
  /** Shows a "done" button that hands the screen back to whatever it replaced. */
  onDone?: () => void;
}) {
  const navigate = useNavigate();
  const { detail, isLoading, isError, error, refetch, selectedServices, updateQuantity } = services;

  if (isLoading) return <LoadingState />;
  if (isError || !detail) {
    return <ErrorState message={(error as Error)?.message || "Không tải được hóa đơn của khách"} onRetry={refetch} />;
  }

  const cart = Array.from(selectedServices.entries());

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-700">
        Dịch vụ đã thêm ({cart.length})
      </h4>

      {cart.length === 0 ? (
        <p className="py-4 text-center text-xs font-semibold text-slate-400">Chưa có dịch vụ nào</p>
      ) : (
        <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
          {cart.map(([serviceId, item]) => (
            <div
              key={serviceId}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2 text-xs"
            >
              <div>
                <p className="font-bold text-slate-900">{item.service.name}</p>
                <p className="text-[10px] text-slate-500">
                  {formatMoney(item.service.price)} x {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.service, item.quantity - 1)}
                  className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 hover:bg-slate-200"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-4 text-center font-bold">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.service, item.quantity + 1)}
                  className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 hover:bg-slate-200"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
        <div className="flex justify-between text-xs text-slate-600">
          <span>Tiền sân:</span>
          <span className="font-semibold">{formatMoney(detail.courtSubtotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>Tiền dịch vụ:</span>
          <span className="font-semibold text-blue-600">+{formatMoney(detail.serviceSubtotal)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-black text-slate-900">
          <span>Tổng phải trả:</span>
          <span className="text-[#02712a]">{formatMoney(detail.remainingAmount)}</span>
        </div>

        <Button className="mt-2 w-full" onClick={() => navigate(`/booking/${bookingId}/checkout`)}>
          <CreditCard className="h-4 w-4" />
          Checkout và thanh toán
        </Button>

        {onDone ? (
          <Button className="w-full" variant="secondary" onClick={onDone}>
            <Check className="h-4 w-4" />
            Xong — quay lại đặt sân
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Inline replacement for `QuickCashierModal` on the surface management page: same POS actions,
 * but rendered next to the schedule so staff never lose sight of the court. Self-contained —
 * catalog and bill stacked in one column.
 */
export function LiveBookingServicePanel({
  bookingId,
  onChanged
}: {
  bookingId: string;
  onChanged?: () => void;
}) {
  const services = useLiveBookingServices(bookingId, onChanged);

  return (
    <div className="space-y-3">
      <LiveBookingServiceCatalog services={services} />
      <LiveBookingBillSummary bookingId={bookingId} services={services} />
    </div>
  );
}
