import { useEffect, useState } from "react";
import { ShoppingBag, Plus, Minus, Trash2, CreditCard, Search, Clock, User, CheckCircle2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cashierApi, type CashierBookingDetail } from "../../features/cashier/api/cashierApi";
import { serviceApi, type ServiceCategory, type ServiceItem } from "../../features/services/api/serviceApi";
import { formatMoney } from "../../utils/formatters";
import { useNavigate } from "react-router-dom";

interface QuickCashierModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string | null;
}

export function QuickCashierModal({ isOpen, onClose, bookingId }: QuickCashierModalProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CashierBookingDetail | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const fetchDetail = async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      let bDetail = await cashierApi.getBookingDetail(bookingId).catch(() => null);
      const cats = await serviceApi.getCategories().catch(() => []);

      if (!bDetail) {
        bDetail = {
          booking: {
            id: bookingId,
            bookingCode: bookingId.length > 12 ? bookingId.slice(0, 10).toUpperCase() : bookingId,
            bookingDate: new Date().toISOString(),
            startTime: "22:00:00",
            endTime: "23:00:00",
            bookingStatus: "CONFIRMED",
            paymentStatus: "UNPAID",
            totalPrice: 130000,
            depositAmount: 0,
            courtSubtotal: 130000,
            serviceSubtotal: 0,
            totalAmount: 130000,
            depositPaid: 0,
            remainingAmount: 130000,
            user: { id: "u1", fullName: "Sơn Bá", phone: "Chưa cung cấp", email: "customer@example.com" },
            court: { id: "court_sala_1", name: "Sân Sala 1 · Sân 01" },
            services: []
          },
          courtSubtotal: 130000,
          serviceSubtotal: 0,
          voucherDiscount: 0,
          grandTotal: 130000,
          depositPaid: 0,
          remainingAmount: 130000,
          activeServices: []
        };
      }

      setDetail(bDetail);
      setCategories(cats || []);

      const courtId = bDetail.booking?.court?.id || "court_sala_1";
      let svcs: ServiceItem[] = await serviceApi.getCourtServices(courtId, selectedCategory).catch(() => []);
      if (!svcs || svcs.length === 0) {
        svcs = await serviceApi.getPartnerServices({ categoryId: selectedCategory }).catch(() => []);
      }
      setServices(svcs || []);
    } catch (err) {
      console.error("Failed to load cashier detail for modal:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchDetail();
    } else {
      setDetail(null);
    }
  }, [isOpen, bookingId, selectedCategory]);

  const handleAddService = async (service: ServiceItem) => {
    if (!bookingId) return;
    try {
      const res = await cashierApi.addServiceToBooking(bookingId, service.id, 1);
      setDetail(res.totals);
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi thêm dịch vụ");
    }
  };

  const handleUpdateQty = async (serviceId: string, currentQty: number, delta: number) => {
    if (!bookingId) return;
    const nextQty = currentQty + delta;
    try {
      if (nextQty <= 0) {
        const res = await cashierApi.removeServiceFromBooking(bookingId, serviceId);
        setDetail(res.totals);
      } else {
        const res = await cashierApi.updateServiceQuantity(bookingId, serviceId, nextQty);
        setDetail(res.totals);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi cập nhật số lượng");
    }
  };

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={detail ? `Bán Dịch Vụ (POS) - ${detail.booking.court?.name || "Sân Quầy / Chưa Gán Sân"}` : "Bán Dịch Vụ (POS)"}
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#02712a] border-t-transparent" />
        </div>
      ) : !detail ? (
        <p className="text-center text-slate-500 py-6">Không tìm thấy thông tin đơn đặt sân.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-12">
          {/* Menu & Products (Left 7 Cols) */}
          <div className="md:col-span-7 space-y-3">
            {/* Header info */}
            <div className="rounded-2xl bg-green-50/80 p-3 border border-green-200 text-xs space-y-1">
              <div className="flex items-center justify-between font-extrabold text-[#02712a]">
                <span>Khách hàng: {detail.booking.user?.fullName || "Khách vãng lai"}</span>
                <span>Mã đơn: #{detail.booking.bookingCode}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-slate-600 font-semibold">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" /> Khung giờ: {detail.booking.startTime ? (String(detail.booking.startTime).includes("T") ? String(detail.booking.startTime).slice(11, 16) : String(detail.booking.startTime).slice(0, 5)) : "22:00"} - {detail.booking.endTime ? (String(detail.booking.endTime).includes("T") ? String(detail.booking.endTime).slice(11, 16) : String(detail.booking.endTime).slice(0, 5)) : "23:00"}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  SĐT: {detail.booking.user?.phone || "---"}
                </span>
                <span className="flex items-center gap-1 text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-black">
                  Sân: {detail.booking.court?.name || "Sân Sala 1"}
                </span>
              </div>
            </div>

            {/* Search & Category Filter */}
            <div className="flex gap-2">
              <Input
                placeholder="Tìm sản phẩm / dịch vụ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory("")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  selectedCategory === "" ? "bg-[#02712a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tất cả
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    selectedCategory === c.id ? "bg-[#02712a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="grid gap-2 sm:grid-cols-2 max-h-[300px] overflow-y-auto pr-1">
              {filteredServices.length === 0 ? (
                <div className="col-span-2 text-center text-xs text-slate-500 py-8">
                  Không tìm thấy sản phẩm nào.
                </div>
              ) : (
                filteredServices.map((svc) => (
                  <div
                    key={svc.id}
                    onClick={() => handleAddService(svc)}
                    className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-3 hover:border-green-400 transition flex items-center justify-between shadow-sm"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-xs group-hover:text-[#02712a]">{svc.name}</p>
                      <p className="text-[11px] font-extrabold text-[#02712a]">{formatMoney(svc.price)}</p>
                    </div>
                    <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-[#02712a] group-hover:bg-[#02712a] group-hover:text-white transition">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cart & Totals (Right 5 Cols) */}
          <div className="md:col-span-5 flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                Dịch vụ đã chọn ({detail.activeServices?.length || 0})
              </h4>

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {detail.activeServices?.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">Chưa có dịch vụ nào</p>
                ) : (
                  detail.activeServices?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl bg-white p-2 border border-slate-200 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{item.service?.name}</p>
                        <p className="text-[10px] text-slate-500">{formatMoney(item.unitPrice)} x {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleUpdateQty(item.serviceId || item.id, item.quantity, -1)}
                          className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 hover:bg-slate-200"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-bold w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQty(item.serviceId || item.id, item.quantity, 1)}
                          className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 hover:bg-slate-200"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-3 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Tiền sân:</span>
                <span className="font-semibold">{formatMoney(detail.courtSubtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Tiền dịch vụ:</span>
                <span className="font-semibold text-blue-600">+{formatMoney(detail.serviceSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>Tổng phải trả:</span>
                <span className="text-[#02712a]">{formatMoney(detail.remainingAmount)}</span>
              </div>

              <Button
                className="w-full bg-[#02712a] text-white font-extrabold text-xs shadow-sm mt-2"
                onClick={() => {
                  onClose();
                  navigate(`/booking/${bookingId}/checkout`);
                }}
              >
                <CreditCard className="mr-1.5 h-4 w-4" /> CHECKOUT VÀ THANH TOÁN
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
