import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingBag, Plus } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { cashierApi } from "../../cashier/api/cashierApi";
import { serviceApi } from "../../services/api/serviceApi";
import { formatMoney } from "../../../utils/formatters";

const RENTABLE_STATUSES = ["CONFIRMED", "DEPOSIT_PAID", "IN_PROGRESS", "CHECKOUT_PENDING"];

/** Local wall-clock instant of a booking date + time ("HH:mm" or an ISO time). */
function wallClock(bookingDate: string, time: string) {
  const clock = time.slice(11, 16) || time.slice(0, 5);
  return new Date(`${bookingDate.slice(0, 10)}T${clock}:00`).getTime();
}

/**
 * Gear can be rented when the cashier accepts it: a booking that is confirmed or playing, already checked in or
 * from 30 minutes before its time until an hour after it.
 */
export function canRentEquipment(booking: { bookingStatus: string; bookingDate: string; startTime: string; endTime: string; checkedInAt?: string | null }) {
  if (!RENTABLE_STATUSES.includes(booking.bookingStatus)) return false;
  if (booking.checkedInAt) return true;
  const now = Date.now();
  return now >= wallClock(booking.bookingDate, booking.startTime) - 30 * 60000 && now <= wallClock(booking.bookingDate, booking.endTime) + 60 * 60000;
}

interface RentEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  courtId: string;
  courtName?: string;
  onRented?: () => void;
}

export function RentEquipmentModal({ isOpen, onClose, bookingId, courtId, courtName, onRented }: RentEquipmentModalProps) {
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const services = useQuery({
    queryKey: ["court-rental-services", courtId],
    queryFn: async () => (await serviceApi.getCourtServices(courtId)).filter((service) => service.type === "RENTAL_SERVICE"),
    enabled: isOpen && Boolean(courtId)
  });
  // What this booking already has out, so the same piece is not handed over twice.
  const detail = useQuery({
    queryKey: ["cashier-booking-detail", bookingId],
    queryFn: () => cashierApi.getBookingDetail(bookingId),
    enabled: isOpen && Boolean(bookingId)
  });
  const rented = (detail.data?.activeServices ?? []).filter((line) => line.service?.type === "RENTAL_SERVICE");

  const handleRent = async (serviceId: string, name: string) => {
    if (submittingId) return;
    setSubmittingId(serviceId);
    try {
      await cashierApi.addServiceToBooking(bookingId, serviceId, 1);
      toast.success(`Đã cho thuê ${name}`);
      await detail.refetch();
      onRented?.();
    } catch (error) {
      toast.error((error as Error).message || "Không thể cho thuê dụng cụ");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Thuê dụng cụ${courtName ? ` - ${courtName}` : ""}`} maxWidth="max-w-lg">
      {rented.length > 0 ? (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-emerald-700">Khách đang thuê</p>
          <ul className="space-y-0.5">
            {rented.map((line) => (
              <li key={line.id} className="flex justify-between gap-2 font-semibold text-slate-700">
                <span>
                  {line.service?.name ?? line.name ?? "Dụng cụ"} × {line.quantity}
                </span>
                <span>{formatMoney(line.totalPrice)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {services.isLoading ? (
        <div className="py-8 text-center text-sm text-slate-500">Đang tải danh sách dụng cụ...</div>
      ) : (services.data ?? []).length === 0 ? (
        <div className="py-8 text-center">
          <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">Không có dụng cụ cho thuê nào.</p>
        </div>
      ) : (
        <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
          {services.data!.map((svc) => (
            <div key={svc.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 transition hover:border-[#02712a]">
              <div>
                <p className="text-sm font-bold text-slate-900">{svc.name}</p>
                <p className="text-xs font-semibold text-[#02712a]">{formatMoney(svc.price)}</p>
              </div>
              <button
                type="button"
                disabled={Boolean(submittingId)}
                onClick={() => handleRent(svc.id, svc.name)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#02712a] transition hover:bg-[#02712a] hover:text-white disabled:opacity-50"
                title="Cho thuê 1 cái"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
