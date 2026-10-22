import { useEffect, useState } from "react";
import { ShoppingBag, Plus } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { cashierApi } from "../../cashier/api/cashierApi";
import { serviceApi, type ServiceItem } from "../../services/api/serviceApi";
import { formatMoney } from "../../../utils/formatters";

interface RentEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  courtId: string;
  courtName?: string;
  onRented?: () => void;
}

export function RentEquipmentModal({ isOpen, onClose, bookingId, courtId, courtName, onRented }: RentEquipmentModalProps) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !courtId) return;
    setLoading(true);
    serviceApi
      .getCourtServices(courtId)
      .then((svcs) => setServices((svcs || []).filter((s) => s.type === "RENTAL_SERVICE")))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [isOpen, courtId]);

  const handleRent = async (service: ServiceItem) => {
    if (submittingId) return;
    setSubmittingId(service.id);
    try {
      await cashierApi.addServiceToBooking(bookingId, service.id, 1);
      onRented?.();
    } catch (err: any) {
      alert(err.message || "Lỗi thuê dụng cụ");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Thuê dụng cụ${courtName ? ` - ${courtName}` : ""}`} maxWidth="max-w-lg">
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Đang tải danh sách dụng cụ...</div>
      ) : services.length === 0 ? (
        <div className="py-8 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-600">Không có dụng cụ cho thuê nào.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 hover:border-[#02712a] transition"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">{svc.name}</p>
                <p className="text-xs font-semibold text-[#02712a]">{formatMoney(svc.price)}</p>
              </div>
              <button
                type="button"
                disabled={submittingId === svc.id}
                onClick={() => handleRent(svc)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#02712a] hover:bg-[#02712a] hover:text-white transition disabled:opacity-50"
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
